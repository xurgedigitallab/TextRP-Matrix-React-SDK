"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = eventSearch;
exports.searchPagination = searchPagination;
var _search = require("matrix-js-sdk/src/@types/search");
var _event = require("matrix-js-sdk/src/@types/event");
var _EventIndexPeg = _interopRequireDefault(require("./indexing/EventIndexPeg"));
/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const SEARCH_LIMIT = 10;
async function serverSideSearch(client, term, roomId, abortSignal) {
  const filter = {
    limit: SEARCH_LIMIT
  };
  if (roomId !== undefined) filter.rooms = [roomId];
  const body = {
    search_categories: {
      room_events: {
        search_term: term,
        filter: filter,
        order_by: _search.SearchOrderBy.Recent,
        event_context: {
          before_limit: 1,
          after_limit: 1,
          include_profile: true
        }
      }
    }
  };
  const response = await client.search({
    body: body
  }, abortSignal);
  return {
    response,
    query: body
  };
}
async function serverSideSearchProcess(client, term, roomId, abortSignal) {
  const result = await serverSideSearch(client, term, roomId, abortSignal);

  // The js-sdk method backPaginateRoomEventsSearch() uses _query internally
  // so we're reusing the concept here since we want to delegate the
  // pagination back to backPaginateRoomEventsSearch() in some cases.
  const searchResults = {
    abortSignal,
    _query: result.query,
    results: [],
    highlights: []
  };
  return client.processRoomEventsSearch(searchResults, result.response);
}
function compareEvents(a, b) {
  const aEvent = a.result;
  const bEvent = b.result;
  if (aEvent.origin_server_ts > bEvent.origin_server_ts) return -1;
  if (aEvent.origin_server_ts < bEvent.origin_server_ts) return 1;
  return 0;
}
async function combinedSearch(client, searchTerm, abortSignal) {
  // Create two promises, one for the local search, one for the
  // server-side search.
  const serverSidePromise = serverSideSearch(client, searchTerm, undefined, abortSignal);
  const localPromise = localSearch(searchTerm);

  // Wait for both promises to resolve.
  await Promise.all([serverSidePromise, localPromise]);

  // Get both search results.
  const localResult = await localPromise;
  const serverSideResult = await serverSidePromise;
  const serverQuery = serverSideResult.query;
  const serverResponse = serverSideResult.response;
  const localQuery = localResult.query;
  const localResponse = localResult.response;

  // Store our queries for later on so we can support pagination.
  //
  // We're reusing _query here again to not introduce separate code paths and
  // concepts for our different pagination methods. We're storing the
  // server-side next batch separately since the query is the json body of
  // the request and next_batch needs to be a query parameter.
  //
  // We can't put it in the final result that _processRoomEventsSearch()
  // returns since that one can be either a server-side one, a local one or a
  // fake one to fetch the remaining cached events. See the docs for
  // combineEvents() for an explanation why we need to cache events.
  const emptyResult = {
    seshatQuery: localQuery,
    _query: serverQuery,
    serverSideNextBatch: serverResponse.search_categories.room_events.next_batch,
    cachedEvents: [],
    oldestEventFrom: "server",
    results: [],
    highlights: []
  };

  // Combine our results.
  const combinedResult = combineResponses(emptyResult, localResponse, serverResponse.search_categories.room_events);

  // Let the client process the combined result.
  const response = {
    search_categories: {
      room_events: combinedResult
    }
  };
  const result = client.processRoomEventsSearch(emptyResult, response);

  // Restore our encryption info so we can properly re-verify the events.
  restoreEncryptionInfo(result.results);
  return result;
}
async function localSearch(searchTerm, roomId) {
  let processResult = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  const eventIndex = _EventIndexPeg.default.get();
  const searchArgs = {
    search_term: searchTerm,
    before_limit: 1,
    after_limit: 1,
    limit: SEARCH_LIMIT,
    order_by_recency: true,
    room_id: undefined
  };
  if (roomId !== undefined) {
    searchArgs.room_id = roomId;
  }
  const localResult = await eventIndex.search(searchArgs);
  if (!localResult) {
    throw new Error("Local search failed");
  }
  searchArgs.next_batch = localResult.next_batch;
  const result = {
    response: localResult,
    query: searchArgs
  };
  return result;
}
async function localSearchProcess(client, searchTerm, roomId) {
  const emptyResult = {
    results: [],
    highlights: []
  };
  if (searchTerm === "") return emptyResult;
  const result = await localSearch(searchTerm, roomId);
  emptyResult.seshatQuery = result.query;
  const response = {
    search_categories: {
      room_events: result.response
    }
  };
  const processedResult = client.processRoomEventsSearch(emptyResult, response);
  // Restore our encryption info so we can properly re-verify the events.
  restoreEncryptionInfo(processedResult.results);
  return processedResult;
}
async function localPagination(client, searchResult) {
  const eventIndex = _EventIndexPeg.default.get();
  const searchArgs = searchResult.seshatQuery;
  const localResult = await eventIndex.search(searchArgs);
  if (!localResult) {
    throw new Error("Local search pagination failed");
  }
  searchResult.seshatQuery.next_batch = localResult.next_batch;

  // We only need to restore the encryption state for the new results, so
  // remember how many of them we got.
  const newResultCount = localResult.results.length;
  const response = {
    search_categories: {
      room_events: localResult
    }
  };
  const result = client.processRoomEventsSearch(searchResult, response);

  // Restore our encryption info so we can properly re-verify the events.
  const newSlice = result.results.slice(Math.max(result.results.length - newResultCount, 0));
  restoreEncryptionInfo(newSlice);
  searchResult.pendingRequest = undefined;
  return result;
}
function compareOldestEvents(firstResults, secondResults) {
  try {
    const oldestFirstEvent = firstResults[firstResults.length - 1].result;
    const oldestSecondEvent = secondResults[secondResults.length - 1].result;
    if (oldestFirstEvent.origin_server_ts <= oldestSecondEvent.origin_server_ts) {
      return -1;
    } else {
      return 1;
    }
  } catch {
    return 0;
  }
}
function combineEventSources(previousSearchResult, response, a, b) {
  // Merge event sources and sort the events.
  const combinedEvents = a.concat(b).sort(compareEvents);
  // Put half of the events in the response, and cache the other half.
  response.results = combinedEvents.slice(0, SEARCH_LIMIT);
  previousSearchResult.cachedEvents = combinedEvents.slice(SEARCH_LIMIT);
}

/**
 * Combine the events from our event sources into a sorted result
 *
 * This method will first be called from the combinedSearch() method. In this
 * case we will fetch SEARCH_LIMIT events from the server and the local index.
 *
 * The method will put the SEARCH_LIMIT newest events from the server and the
 * local index in the results part of the response, the rest will be put in the
 * cachedEvents field of the previousSearchResult (in this case an empty search
 * result).
 *
 * Every subsequent call will be made from the combinedPagination() method, in
 * this case we will combine the cachedEvents and the next SEARCH_LIMIT events
 * from either the server or the local index.
 *
 * Since we have two event sources and we need to sort the results by date we
 * need keep on looking for the oldest event. We are implementing a variation of
 * a sliding window.
 *
 * The event sources are here represented as two sorted lists where the smallest
 * number represents the newest event. The two lists need to be merged in a way
 * that preserves the sorted property so they can be shown as one search result.
 * We first fetch SEARCH_LIMIT events from both sources.
 *
 * If we set SEARCH_LIMIT to 3:
 *
 *  Server events [01, 02, 04, 06, 07, 08, 11, 13]
 *                |01, 02, 04|
 *  Local events  [03, 05, 09, 10, 12, 14, 15, 16]
 *                |03, 05, 09|
 *
 *  We note that the oldest event is from the local index, and we combine the
 *  results:
 *
 *  Server window [01, 02, 04]
 *  Local window  [03, 05, 09]
 *
 *  Combined events [01, 02, 03, 04, 05, 09]
 *
 *  We split the combined result in the part that we want to present and a part
 *  that will be cached.
 *
 *  Presented events [01, 02, 03]
 *  Cached events    [04, 05, 09]
 *
 *  We slide the window for the server since the oldest event is from the local
 *  index.
 *
 *  Server events [01, 02, 04, 06, 07, 08, 11, 13]
 *                            |06, 07, 08|
 *  Local events  [03, 05, 09, 10, 12, 14, 15, 16]
 *                |XX, XX, XX|
 *  Cached events [04, 05, 09]
 *
 *  We note that the oldest event is from the server and we combine the new
 *  server events with the cached ones.
 *
 *  Cached events [04, 05, 09]
 *  Server events [06, 07, 08]
 *
 *  Combined events [04, 05, 06, 07, 08, 09]
 *
 *  We split again.
 *
 *  Presented events [04, 05, 06]
 *  Cached events    [07, 08, 09]
 *
 *  We slide the local window, the oldest event is on the server.
 *
 *  Server events [01, 02, 04, 06, 07, 08, 11, 13]
 *                            |XX, XX, XX|
 *  Local events  [03, 05, 09, 10, 12, 14, 15, 16]
 *                            |10, 12, 14|
 *
 *  Cached events [07, 08, 09]
 *  Local events  [10, 12, 14]
 *  Combined events [07, 08, 09, 10, 12, 14]
 *
 *  Presented events [07, 08, 09]
 *  Cached events    [10, 12, 14]
 *
 *  Next up we slide the server window again.
 *
 *  Server events [01, 02, 04, 06, 07, 08, 11, 13]
 *                                        |11, 13|
 *  Local events  [03, 05, 09, 10, 12, 14, 15, 16]
 *                            |XX, XX, XX|
 *
 *  Cached events [10, 12, 14]
 *  Server events [11, 13]
 *  Combined events [10, 11, 12, 13, 14]
 *
 *  Presented events [10, 11, 12]
 *  Cached events    [13, 14]
 *
 *  We have one source exhausted, we fetch the rest of our events from the other
 *  source and combine it with our cached events.
 *
 *
 * @param {object} previousSearchResult A search result from a previous search
 * call.
 * @param {object} localEvents An unprocessed search result from the event
 * index.
 * @param {object} serverEvents An unprocessed search result from the server.
 *
 * @return {object} A response object that combines the events from the
 * different event sources.
 *
 */
function combineEvents(previousSearchResult, localEvents, serverEvents) {
  const response = {};
  const cachedEvents = previousSearchResult.cachedEvents;
  let oldestEventFrom = previousSearchResult.oldestEventFrom;
  response.highlights = previousSearchResult.highlights;
  if (localEvents && serverEvents && serverEvents.results) {
    // This is a first search call, combine the events from the server and
    // the local index. Note where our oldest event came from, we shall
    // fetch the next batch of events from the other source.
    if (compareOldestEvents(localEvents.results, serverEvents.results) < 0) {
      oldestEventFrom = "local";
    }
    combineEventSources(previousSearchResult, response, localEvents.results, serverEvents.results);
    response.highlights = localEvents.highlights.concat(serverEvents.highlights);
  } else if (localEvents) {
    // This is a pagination call fetching more events from the local index,
    // meaning that our oldest event was on the server.
    // Change the source of the oldest event if our local event is older
    // than the cached one.
    if (compareOldestEvents(localEvents.results, cachedEvents) < 0) {
      oldestEventFrom = "local";
    }
    combineEventSources(previousSearchResult, response, localEvents.results, cachedEvents);
  } else if (serverEvents && serverEvents.results) {
    // This is a pagination call fetching more events from the server,
    // meaning that our oldest event was in the local index.
    // Change the source of the oldest event if our server event is older
    // than the cached one.
    if (compareOldestEvents(serverEvents.results, cachedEvents) < 0) {
      oldestEventFrom = "server";
    }
    combineEventSources(previousSearchResult, response, serverEvents.results, cachedEvents);
  } else {
    // This is a pagination call where we exhausted both of our event
    // sources, let's push the remaining cached events.
    response.results = cachedEvents;
    previousSearchResult.cachedEvents = [];
  }
  previousSearchResult.oldestEventFrom = oldestEventFrom;
  return response;
}

/**
 * Combine the local and server search responses
 *
 * @param {object} previousSearchResult A search result from a previous search
 * call.
 * @param {object} localEvents An unprocessed search result from the event
 * index.
 * @param {object} serverEvents An unprocessed search result from the server.
 *
 * @return {object} A response object that combines the events from the
 * different event sources.
 */
function combineResponses(previousSearchResult, localEvents, serverEvents) {
  // Combine our events first.
  const response = combineEvents(previousSearchResult, localEvents, serverEvents);

  // Our first search will contain counts from both sources, subsequent
  // pagination requests will fetch responses only from one of the sources, so
  // reuse the first count when we're paginating.
  if (previousSearchResult.count) {
    response.count = previousSearchResult.count;
  } else {
    response.count = localEvents.count + serverEvents.count;
  }

  // Update our next batch tokens for the given search sources.
  if (localEvents) {
    previousSearchResult.seshatQuery.next_batch = localEvents.next_batch;
  }
  if (serverEvents) {
    previousSearchResult.serverSideNextBatch = serverEvents.next_batch;
  }

  // Set the response next batch token to one of the tokens from the sources,
  // this makes sure that if we exhaust one of the sources we continue with
  // the other one.
  if (previousSearchResult.seshatQuery?.next_batch) {
    response.next_batch = previousSearchResult.seshatQuery.next_batch;
  } else if (previousSearchResult.serverSideNextBatch) {
    response.next_batch = previousSearchResult.serverSideNextBatch;
  }

  // We collected all search results from the server as well as from Seshat,
  // we still have some events cached that we'll want to display on the next
  // pagination request.
  //
  // Provide a fake next batch token for that case.
  if (!response.next_batch && previousSearchResult.cachedEvents.length > 0) {
    response.next_batch = "cached";
  }
  return response;
}
function restoreEncryptionInfo() {
  let searchResultSlice = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  for (const result of searchResultSlice) {
    const timeline = result.context.getTimeline();
    for (const mxEv of timeline) {
      const ev = mxEv.event;
      if (ev.curve25519Key) {
        mxEv.makeEncrypted(_event.EventType.RoomMessageEncrypted, {
          algorithm: ev.algorithm
        }, ev.curve25519Key, ev.ed25519Key);
        // @ts-ignore
        mxEv.forwardingCurve25519KeyChain = ev.forwardingCurve25519KeyChain;
        delete ev.curve25519Key;
        delete ev.ed25519Key;
        delete ev.algorithm;
        delete ev.forwardingCurve25519KeyChain;
      }
    }
  }
}
async function combinedPagination(client, searchResult) {
  const eventIndex = _EventIndexPeg.default.get();
  const searchArgs = searchResult.seshatQuery;
  const oldestEventFrom = searchResult.oldestEventFrom;
  let localResult;
  let serverSideResult;

  // Fetch events from the local index if we have a token for it and if it's
  // the local indexes turn or the server has exhausted its results.
  if (searchArgs?.next_batch && (!searchResult.serverSideNextBatch || oldestEventFrom === "server")) {
    localResult = await eventIndex.search(searchArgs);
  }

  // Fetch events from the server if we have a token for it and if it's the
  // local indexes turn or the local index has exhausted its results.
  if (searchResult.serverSideNextBatch && (oldestEventFrom === "local" || !searchArgs.next_batch)) {
    const body = {
      body: searchResult._query,
      next_batch: searchResult.serverSideNextBatch
    };
    serverSideResult = await client.search(body);
  }
  let serverEvents;
  if (serverSideResult) {
    serverEvents = serverSideResult.search_categories.room_events;
  }

  // Combine our events.
  const combinedResult = combineResponses(searchResult, localResult, serverEvents);
  const response = {
    search_categories: {
      room_events: combinedResult
    }
  };
  const oldResultCount = searchResult.results ? searchResult.results.length : 0;

  // Let the client process the combined result.
  const result = client.processRoomEventsSearch(searchResult, response);

  // Restore our encryption info so we can properly re-verify the events.
  const newResultCount = result.results.length - oldResultCount;
  const newSlice = result.results.slice(Math.max(result.results.length - newResultCount, 0));
  restoreEncryptionInfo(newSlice);
  searchResult.pendingRequest = undefined;
  return result;
}
function eventIndexSearch(client, term, roomId, abortSignal) {
  let searchPromise;
  if (roomId !== undefined) {
    if (client.isRoomEncrypted(roomId)) {
      // The search is for a single encrypted room, use our local
      // search method.
      searchPromise = localSearchProcess(client, term, roomId);
    } else {
      // The search is for a single non-encrypted room, use the
      // server-side search.
      searchPromise = serverSideSearchProcess(client, term, roomId, abortSignal);
    }
  } else {
    // Search across all rooms, combine a server side search and a
    // local search.
    searchPromise = combinedSearch(client, term, abortSignal);
  }
  return searchPromise;
}
function eventIndexSearchPagination(client, searchResult) {
  const seshatQuery = searchResult.seshatQuery;
  const serverQuery = searchResult._query;
  if (!seshatQuery) {
    // This is a search in a non-encrypted room. Do the normal server-side
    // pagination.
    return client.backPaginateRoomEventsSearch(searchResult);
  } else if (!serverQuery) {
    // This is a search in a encrypted room. Do a local pagination.
    const promise = localPagination(client, searchResult);
    searchResult.pendingRequest = promise;
    return promise;
  } else {
    // We have both queries around, this is a search across all rooms so a
    // combined pagination needs to be done.
    const promise = combinedPagination(client, searchResult);
    searchResult.pendingRequest = promise;
    return promise;
  }
}
function searchPagination(client, searchResult) {
  const eventIndex = _EventIndexPeg.default.get();
  if (searchResult.pendingRequest) return searchResult.pendingRequest;
  if (eventIndex === null) return client.backPaginateRoomEventsSearch(searchResult);else return eventIndexSearchPagination(client, searchResult);
}
function eventSearch(client, term, roomId, abortSignal) {
  const eventIndex = _EventIndexPeg.default.get();
  if (eventIndex === null) {
    return serverSideSearchProcess(client, term, roomId, abortSignal);
  } else {
    return eventIndexSearch(client, term, roomId, abortSignal);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfc2VhcmNoIiwicmVxdWlyZSIsIl9ldmVudCIsIl9FdmVudEluZGV4UGVnIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIlNFQVJDSF9MSU1JVCIsInNlcnZlclNpZGVTZWFyY2giLCJjbGllbnQiLCJ0ZXJtIiwicm9vbUlkIiwiYWJvcnRTaWduYWwiLCJmaWx0ZXIiLCJsaW1pdCIsInVuZGVmaW5lZCIsInJvb21zIiwiYm9keSIsInNlYXJjaF9jYXRlZ29yaWVzIiwicm9vbV9ldmVudHMiLCJzZWFyY2hfdGVybSIsIm9yZGVyX2J5IiwiU2VhcmNoT3JkZXJCeSIsIlJlY2VudCIsImV2ZW50X2NvbnRleHQiLCJiZWZvcmVfbGltaXQiLCJhZnRlcl9saW1pdCIsImluY2x1ZGVfcHJvZmlsZSIsInJlc3BvbnNlIiwic2VhcmNoIiwicXVlcnkiLCJzZXJ2ZXJTaWRlU2VhcmNoUHJvY2VzcyIsInJlc3VsdCIsInNlYXJjaFJlc3VsdHMiLCJfcXVlcnkiLCJyZXN1bHRzIiwiaGlnaGxpZ2h0cyIsInByb2Nlc3NSb29tRXZlbnRzU2VhcmNoIiwiY29tcGFyZUV2ZW50cyIsImEiLCJiIiwiYUV2ZW50IiwiYkV2ZW50Iiwib3JpZ2luX3NlcnZlcl90cyIsImNvbWJpbmVkU2VhcmNoIiwic2VhcmNoVGVybSIsInNlcnZlclNpZGVQcm9taXNlIiwibG9jYWxQcm9taXNlIiwibG9jYWxTZWFyY2giLCJQcm9taXNlIiwiYWxsIiwibG9jYWxSZXN1bHQiLCJzZXJ2ZXJTaWRlUmVzdWx0Iiwic2VydmVyUXVlcnkiLCJzZXJ2ZXJSZXNwb25zZSIsImxvY2FsUXVlcnkiLCJsb2NhbFJlc3BvbnNlIiwiZW1wdHlSZXN1bHQiLCJzZXNoYXRRdWVyeSIsInNlcnZlclNpZGVOZXh0QmF0Y2giLCJuZXh0X2JhdGNoIiwiY2FjaGVkRXZlbnRzIiwib2xkZXN0RXZlbnRGcm9tIiwiY29tYmluZWRSZXN1bHQiLCJjb21iaW5lUmVzcG9uc2VzIiwicmVzdG9yZUVuY3J5cHRpb25JbmZvIiwicHJvY2Vzc1Jlc3VsdCIsImFyZ3VtZW50cyIsImxlbmd0aCIsImV2ZW50SW5kZXgiLCJFdmVudEluZGV4UGVnIiwiZ2V0Iiwic2VhcmNoQXJncyIsIm9yZGVyX2J5X3JlY2VuY3kiLCJyb29tX2lkIiwiRXJyb3IiLCJsb2NhbFNlYXJjaFByb2Nlc3MiLCJwcm9jZXNzZWRSZXN1bHQiLCJsb2NhbFBhZ2luYXRpb24iLCJzZWFyY2hSZXN1bHQiLCJuZXdSZXN1bHRDb3VudCIsIm5ld1NsaWNlIiwic2xpY2UiLCJNYXRoIiwibWF4IiwicGVuZGluZ1JlcXVlc3QiLCJjb21wYXJlT2xkZXN0RXZlbnRzIiwiZmlyc3RSZXN1bHRzIiwic2Vjb25kUmVzdWx0cyIsIm9sZGVzdEZpcnN0RXZlbnQiLCJvbGRlc3RTZWNvbmRFdmVudCIsImNvbWJpbmVFdmVudFNvdXJjZXMiLCJwcmV2aW91c1NlYXJjaFJlc3VsdCIsImNvbWJpbmVkRXZlbnRzIiwiY29uY2F0Iiwic29ydCIsImNvbWJpbmVFdmVudHMiLCJsb2NhbEV2ZW50cyIsInNlcnZlckV2ZW50cyIsImNvdW50Iiwic2VhcmNoUmVzdWx0U2xpY2UiLCJ0aW1lbGluZSIsImNvbnRleHQiLCJnZXRUaW1lbGluZSIsIm14RXYiLCJldiIsImV2ZW50IiwiY3VydmUyNTUxOUtleSIsIm1ha2VFbmNyeXB0ZWQiLCJFdmVudFR5cGUiLCJSb29tTWVzc2FnZUVuY3J5cHRlZCIsImFsZ29yaXRobSIsImVkMjU1MTlLZXkiLCJmb3J3YXJkaW5nQ3VydmUyNTUxOUtleUNoYWluIiwiY29tYmluZWRQYWdpbmF0aW9uIiwib2xkUmVzdWx0Q291bnQiLCJldmVudEluZGV4U2VhcmNoIiwic2VhcmNoUHJvbWlzZSIsImlzUm9vbUVuY3J5cHRlZCIsImV2ZW50SW5kZXhTZWFyY2hQYWdpbmF0aW9uIiwiYmFja1BhZ2luYXRlUm9vbUV2ZW50c1NlYXJjaCIsInByb21pc2UiLCJzZWFyY2hQYWdpbmF0aW9uIiwiZXZlbnRTZWFyY2giXSwic291cmNlcyI6WyIuLi9zcmMvU2VhcmNoaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxOSAtIDIwMjEgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQge1xuICAgIElSZXN1bHRSb29tRXZlbnRzLFxuICAgIElTZWFyY2hSZXF1ZXN0Qm9keSxcbiAgICBJU2VhcmNoUmVzcG9uc2UsXG4gICAgSVNlYXJjaFJlc3VsdCxcbiAgICBJU2VhcmNoUmVzdWx0cyxcbiAgICBTZWFyY2hPcmRlckJ5LFxufSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL3NlYXJjaFwiO1xuaW1wb3J0IHsgSVJvb21FdmVudEZpbHRlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9maWx0ZXJcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IFNlYXJjaFJlc3VsdCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvc2VhcmNoLXJlc3VsdFwiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuXG5pbXBvcnQgeyBJU2VhcmNoQXJncyB9IGZyb20gXCIuL2luZGV4aW5nL0Jhc2VFdmVudEluZGV4TWFuYWdlclwiO1xuaW1wb3J0IEV2ZW50SW5kZXhQZWcgZnJvbSBcIi4vaW5kZXhpbmcvRXZlbnRJbmRleFBlZ1wiO1xuXG5jb25zdCBTRUFSQ0hfTElNSVQgPSAxMDtcblxuYXN5bmMgZnVuY3Rpb24gc2VydmVyU2lkZVNlYXJjaChcbiAgICBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICB0ZXJtOiBzdHJpbmcsXG4gICAgcm9vbUlkPzogc3RyaW5nLFxuICAgIGFib3J0U2lnbmFsPzogQWJvcnRTaWduYWwsXG4pOiBQcm9taXNlPHsgcmVzcG9uc2U6IElTZWFyY2hSZXNwb25zZTsgcXVlcnk6IElTZWFyY2hSZXF1ZXN0Qm9keSB9PiB7XG4gICAgY29uc3QgZmlsdGVyOiBJUm9vbUV2ZW50RmlsdGVyID0ge1xuICAgICAgICBsaW1pdDogU0VBUkNIX0xJTUlULFxuICAgIH07XG5cbiAgICBpZiAocm9vbUlkICE9PSB1bmRlZmluZWQpIGZpbHRlci5yb29tcyA9IFtyb29tSWRdO1xuXG4gICAgY29uc3QgYm9keTogSVNlYXJjaFJlcXVlc3RCb2R5ID0ge1xuICAgICAgICBzZWFyY2hfY2F0ZWdvcmllczoge1xuICAgICAgICAgICAgcm9vbV9ldmVudHM6IHtcbiAgICAgICAgICAgICAgICBzZWFyY2hfdGVybTogdGVybSxcbiAgICAgICAgICAgICAgICBmaWx0ZXI6IGZpbHRlcixcbiAgICAgICAgICAgICAgICBvcmRlcl9ieTogU2VhcmNoT3JkZXJCeS5SZWNlbnQsXG4gICAgICAgICAgICAgICAgZXZlbnRfY29udGV4dDoge1xuICAgICAgICAgICAgICAgICAgICBiZWZvcmVfbGltaXQ6IDEsXG4gICAgICAgICAgICAgICAgICAgIGFmdGVyX2xpbWl0OiAxLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlX3Byb2ZpbGU6IHRydWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LnNlYXJjaCh7IGJvZHk6IGJvZHkgfSwgYWJvcnRTaWduYWwpO1xuXG4gICAgcmV0dXJuIHsgcmVzcG9uc2UsIHF1ZXJ5OiBib2R5IH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlcnZlclNpZGVTZWFyY2hQcm9jZXNzKFxuICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgIHRlcm06IHN0cmluZyxcbiAgICByb29tSWQ/OiBzdHJpbmcsXG4gICAgYWJvcnRTaWduYWw/OiBBYm9ydFNpZ25hbCxcbik6IFByb21pc2U8SVNlYXJjaFJlc3VsdHM+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2ZXJTaWRlU2VhcmNoKGNsaWVudCwgdGVybSwgcm9vbUlkLCBhYm9ydFNpZ25hbCk7XG5cbiAgICAvLyBUaGUganMtc2RrIG1ldGhvZCBiYWNrUGFnaW5hdGVSb29tRXZlbnRzU2VhcmNoKCkgdXNlcyBfcXVlcnkgaW50ZXJuYWxseVxuICAgIC8vIHNvIHdlJ3JlIHJldXNpbmcgdGhlIGNvbmNlcHQgaGVyZSBzaW5jZSB3ZSB3YW50IHRvIGRlbGVnYXRlIHRoZVxuICAgIC8vIHBhZ2luYXRpb24gYmFjayB0byBiYWNrUGFnaW5hdGVSb29tRXZlbnRzU2VhcmNoKCkgaW4gc29tZSBjYXNlcy5cbiAgICBjb25zdCBzZWFyY2hSZXN1bHRzOiBJU2VhcmNoUmVzdWx0cyA9IHtcbiAgICAgICAgYWJvcnRTaWduYWwsXG4gICAgICAgIF9xdWVyeTogcmVzdWx0LnF1ZXJ5LFxuICAgICAgICByZXN1bHRzOiBbXSxcbiAgICAgICAgaGlnaGxpZ2h0czogW10sXG4gICAgfTtcblxuICAgIHJldHVybiBjbGllbnQucHJvY2Vzc1Jvb21FdmVudHNTZWFyY2goc2VhcmNoUmVzdWx0cywgcmVzdWx0LnJlc3BvbnNlKTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZUV2ZW50cyhhOiBJU2VhcmNoUmVzdWx0LCBiOiBJU2VhcmNoUmVzdWx0KTogbnVtYmVyIHtcbiAgICBjb25zdCBhRXZlbnQgPSBhLnJlc3VsdDtcbiAgICBjb25zdCBiRXZlbnQgPSBiLnJlc3VsdDtcblxuICAgIGlmIChhRXZlbnQub3JpZ2luX3NlcnZlcl90cyA+IGJFdmVudC5vcmlnaW5fc2VydmVyX3RzKSByZXR1cm4gLTE7XG4gICAgaWYgKGFFdmVudC5vcmlnaW5fc2VydmVyX3RzIDwgYkV2ZW50Lm9yaWdpbl9zZXJ2ZXJfdHMpIHJldHVybiAxO1xuXG4gICAgcmV0dXJuIDA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbWJpbmVkU2VhcmNoKFxuICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgIHNlYXJjaFRlcm06IHN0cmluZyxcbiAgICBhYm9ydFNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0cz4ge1xuICAgIC8vIENyZWF0ZSB0d28gcHJvbWlzZXMsIG9uZSBmb3IgdGhlIGxvY2FsIHNlYXJjaCwgb25lIGZvciB0aGVcbiAgICAvLyBzZXJ2ZXItc2lkZSBzZWFyY2guXG4gICAgY29uc3Qgc2VydmVyU2lkZVByb21pc2UgPSBzZXJ2ZXJTaWRlU2VhcmNoKGNsaWVudCwgc2VhcmNoVGVybSwgdW5kZWZpbmVkLCBhYm9ydFNpZ25hbCk7XG4gICAgY29uc3QgbG9jYWxQcm9taXNlID0gbG9jYWxTZWFyY2goc2VhcmNoVGVybSk7XG5cbiAgICAvLyBXYWl0IGZvciBib3RoIHByb21pc2VzIHRvIHJlc29sdmUuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW3NlcnZlclNpZGVQcm9taXNlLCBsb2NhbFByb21pc2VdKTtcblxuICAgIC8vIEdldCBib3RoIHNlYXJjaCByZXN1bHRzLlxuICAgIGNvbnN0IGxvY2FsUmVzdWx0ID0gYXdhaXQgbG9jYWxQcm9taXNlO1xuICAgIGNvbnN0IHNlcnZlclNpZGVSZXN1bHQgPSBhd2FpdCBzZXJ2ZXJTaWRlUHJvbWlzZTtcblxuICAgIGNvbnN0IHNlcnZlclF1ZXJ5ID0gc2VydmVyU2lkZVJlc3VsdC5xdWVyeTtcbiAgICBjb25zdCBzZXJ2ZXJSZXNwb25zZSA9IHNlcnZlclNpZGVSZXN1bHQucmVzcG9uc2U7XG5cbiAgICBjb25zdCBsb2NhbFF1ZXJ5ID0gbG9jYWxSZXN1bHQucXVlcnk7XG4gICAgY29uc3QgbG9jYWxSZXNwb25zZSA9IGxvY2FsUmVzdWx0LnJlc3BvbnNlO1xuXG4gICAgLy8gU3RvcmUgb3VyIHF1ZXJpZXMgZm9yIGxhdGVyIG9uIHNvIHdlIGNhbiBzdXBwb3J0IHBhZ2luYXRpb24uXG4gICAgLy9cbiAgICAvLyBXZSdyZSByZXVzaW5nIF9xdWVyeSBoZXJlIGFnYWluIHRvIG5vdCBpbnRyb2R1Y2Ugc2VwYXJhdGUgY29kZSBwYXRocyBhbmRcbiAgICAvLyBjb25jZXB0cyBmb3Igb3VyIGRpZmZlcmVudCBwYWdpbmF0aW9uIG1ldGhvZHMuIFdlJ3JlIHN0b3JpbmcgdGhlXG4gICAgLy8gc2VydmVyLXNpZGUgbmV4dCBiYXRjaCBzZXBhcmF0ZWx5IHNpbmNlIHRoZSBxdWVyeSBpcyB0aGUganNvbiBib2R5IG9mXG4gICAgLy8gdGhlIHJlcXVlc3QgYW5kIG5leHRfYmF0Y2ggbmVlZHMgdG8gYmUgYSBxdWVyeSBwYXJhbWV0ZXIuXG4gICAgLy9cbiAgICAvLyBXZSBjYW4ndCBwdXQgaXQgaW4gdGhlIGZpbmFsIHJlc3VsdCB0aGF0IF9wcm9jZXNzUm9vbUV2ZW50c1NlYXJjaCgpXG4gICAgLy8gcmV0dXJucyBzaW5jZSB0aGF0IG9uZSBjYW4gYmUgZWl0aGVyIGEgc2VydmVyLXNpZGUgb25lLCBhIGxvY2FsIG9uZSBvciBhXG4gICAgLy8gZmFrZSBvbmUgdG8gZmV0Y2ggdGhlIHJlbWFpbmluZyBjYWNoZWQgZXZlbnRzLiBTZWUgdGhlIGRvY3MgZm9yXG4gICAgLy8gY29tYmluZUV2ZW50cygpIGZvciBhbiBleHBsYW5hdGlvbiB3aHkgd2UgbmVlZCB0byBjYWNoZSBldmVudHMuXG4gICAgY29uc3QgZW1wdHlSZXN1bHQ6IElTZXNoYXRTZWFyY2hSZXN1bHRzID0ge1xuICAgICAgICBzZXNoYXRRdWVyeTogbG9jYWxRdWVyeSxcbiAgICAgICAgX3F1ZXJ5OiBzZXJ2ZXJRdWVyeSxcbiAgICAgICAgc2VydmVyU2lkZU5leHRCYXRjaDogc2VydmVyUmVzcG9uc2Uuc2VhcmNoX2NhdGVnb3JpZXMucm9vbV9ldmVudHMubmV4dF9iYXRjaCxcbiAgICAgICAgY2FjaGVkRXZlbnRzOiBbXSxcbiAgICAgICAgb2xkZXN0RXZlbnRGcm9tOiBcInNlcnZlclwiLFxuICAgICAgICByZXN1bHRzOiBbXSxcbiAgICAgICAgaGlnaGxpZ2h0czogW10sXG4gICAgfTtcblxuICAgIC8vIENvbWJpbmUgb3VyIHJlc3VsdHMuXG4gICAgY29uc3QgY29tYmluZWRSZXN1bHQgPSBjb21iaW5lUmVzcG9uc2VzKGVtcHR5UmVzdWx0LCBsb2NhbFJlc3BvbnNlLCBzZXJ2ZXJSZXNwb25zZS5zZWFyY2hfY2F0ZWdvcmllcy5yb29tX2V2ZW50cyk7XG5cbiAgICAvLyBMZXQgdGhlIGNsaWVudCBwcm9jZXNzIHRoZSBjb21iaW5lZCByZXN1bHQuXG4gICAgY29uc3QgcmVzcG9uc2U6IElTZWFyY2hSZXNwb25zZSA9IHtcbiAgICAgICAgc2VhcmNoX2NhdGVnb3JpZXM6IHtcbiAgICAgICAgICAgIHJvb21fZXZlbnRzOiBjb21iaW5lZFJlc3VsdCxcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0gY2xpZW50LnByb2Nlc3NSb29tRXZlbnRzU2VhcmNoKGVtcHR5UmVzdWx0LCByZXNwb25zZSk7XG5cbiAgICAvLyBSZXN0b3JlIG91ciBlbmNyeXB0aW9uIGluZm8gc28gd2UgY2FuIHByb3Blcmx5IHJlLXZlcmlmeSB0aGUgZXZlbnRzLlxuICAgIHJlc3RvcmVFbmNyeXB0aW9uSW5mbyhyZXN1bHQucmVzdWx0cyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2NhbFNlYXJjaChcbiAgICBzZWFyY2hUZXJtOiBzdHJpbmcsXG4gICAgcm9vbUlkPzogc3RyaW5nLFxuICAgIHByb2Nlc3NSZXN1bHQgPSB0cnVlLFxuKTogUHJvbWlzZTx7IHJlc3BvbnNlOiBJUmVzdWx0Um9vbUV2ZW50czsgcXVlcnk6IElTZWFyY2hBcmdzIH0+IHtcbiAgICBjb25zdCBldmVudEluZGV4ID0gRXZlbnRJbmRleFBlZy5nZXQoKTtcblxuICAgIGNvbnN0IHNlYXJjaEFyZ3M6IElTZWFyY2hBcmdzID0ge1xuICAgICAgICBzZWFyY2hfdGVybTogc2VhcmNoVGVybSxcbiAgICAgICAgYmVmb3JlX2xpbWl0OiAxLFxuICAgICAgICBhZnRlcl9saW1pdDogMSxcbiAgICAgICAgbGltaXQ6IFNFQVJDSF9MSU1JVCxcbiAgICAgICAgb3JkZXJfYnlfcmVjZW5jeTogdHJ1ZSxcbiAgICAgICAgcm9vbV9pZDogdW5kZWZpbmVkLFxuICAgIH07XG5cbiAgICBpZiAocm9vbUlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2VhcmNoQXJncy5yb29tX2lkID0gcm9vbUlkO1xuICAgIH1cblxuICAgIGNvbnN0IGxvY2FsUmVzdWx0ID0gYXdhaXQgZXZlbnRJbmRleCEuc2VhcmNoKHNlYXJjaEFyZ3MpO1xuICAgIGlmICghbG9jYWxSZXN1bHQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTG9jYWwgc2VhcmNoIGZhaWxlZFwiKTtcbiAgICB9XG5cbiAgICBzZWFyY2hBcmdzLm5leHRfYmF0Y2ggPSBsb2NhbFJlc3VsdC5uZXh0X2JhdGNoO1xuXG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICByZXNwb25zZTogbG9jYWxSZXN1bHQsXG4gICAgICAgIHF1ZXJ5OiBzZWFyY2hBcmdzLFxuICAgIH07XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXNoYXRTZWFyY2hSZXN1bHRzIGV4dGVuZHMgSVNlYXJjaFJlc3VsdHMge1xuICAgIHNlc2hhdFF1ZXJ5PzogSVNlYXJjaEFyZ3M7XG4gICAgY2FjaGVkRXZlbnRzPzogSVNlYXJjaFJlc3VsdFtdO1xuICAgIG9sZGVzdEV2ZW50RnJvbT86IFwibG9jYWxcIiB8IFwic2VydmVyXCI7XG4gICAgc2VydmVyU2lkZU5leHRCYXRjaD86IHN0cmluZztcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9jYWxTZWFyY2hQcm9jZXNzKFxuICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgIHNlYXJjaFRlcm06IHN0cmluZyxcbiAgICByb29tSWQ/OiBzdHJpbmcsXG4pOiBQcm9taXNlPElTZXNoYXRTZWFyY2hSZXN1bHRzPiB7XG4gICAgY29uc3QgZW1wdHlSZXN1bHQgPSB7XG4gICAgICAgIHJlc3VsdHM6IFtdLFxuICAgICAgICBoaWdobGlnaHRzOiBbXSxcbiAgICB9IGFzIElTZXNoYXRTZWFyY2hSZXN1bHRzO1xuXG4gICAgaWYgKHNlYXJjaFRlcm0gPT09IFwiXCIpIHJldHVybiBlbXB0eVJlc3VsdDtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvY2FsU2VhcmNoKHNlYXJjaFRlcm0sIHJvb21JZCk7XG5cbiAgICBlbXB0eVJlc3VsdC5zZXNoYXRRdWVyeSA9IHJlc3VsdC5xdWVyeTtcblxuICAgIGNvbnN0IHJlc3BvbnNlOiBJU2VhcmNoUmVzcG9uc2UgPSB7XG4gICAgICAgIHNlYXJjaF9jYXRlZ29yaWVzOiB7XG4gICAgICAgICAgICByb29tX2V2ZW50czogcmVzdWx0LnJlc3BvbnNlLFxuICAgICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBwcm9jZXNzZWRSZXN1bHQgPSBjbGllbnQucHJvY2Vzc1Jvb21FdmVudHNTZWFyY2goZW1wdHlSZXN1bHQsIHJlc3BvbnNlKTtcbiAgICAvLyBSZXN0b3JlIG91ciBlbmNyeXB0aW9uIGluZm8gc28gd2UgY2FuIHByb3Blcmx5IHJlLXZlcmlmeSB0aGUgZXZlbnRzLlxuICAgIHJlc3RvcmVFbmNyeXB0aW9uSW5mbyhwcm9jZXNzZWRSZXN1bHQucmVzdWx0cyk7XG5cbiAgICByZXR1cm4gcHJvY2Vzc2VkUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2NhbFBhZ2luYXRpb24oXG4gICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgc2VhcmNoUmVzdWx0OiBJU2VzaGF0U2VhcmNoUmVzdWx0cyxcbik6IFByb21pc2U8SVNlc2hhdFNlYXJjaFJlc3VsdHM+IHtcbiAgICBjb25zdCBldmVudEluZGV4ID0gRXZlbnRJbmRleFBlZy5nZXQoKTtcblxuICAgIGNvbnN0IHNlYXJjaEFyZ3MgPSBzZWFyY2hSZXN1bHQuc2VzaGF0UXVlcnk7XG5cbiAgICBjb25zdCBsb2NhbFJlc3VsdCA9IGF3YWl0IGV2ZW50SW5kZXghLnNlYXJjaChzZWFyY2hBcmdzKTtcbiAgICBpZiAoIWxvY2FsUmVzdWx0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkxvY2FsIHNlYXJjaCBwYWdpbmF0aW9uIGZhaWxlZFwiKTtcbiAgICB9XG5cbiAgICBzZWFyY2hSZXN1bHQuc2VzaGF0UXVlcnkubmV4dF9iYXRjaCA9IGxvY2FsUmVzdWx0Lm5leHRfYmF0Y2g7XG5cbiAgICAvLyBXZSBvbmx5IG5lZWQgdG8gcmVzdG9yZSB0aGUgZW5jcnlwdGlvbiBzdGF0ZSBmb3IgdGhlIG5ldyByZXN1bHRzLCBzb1xuICAgIC8vIHJlbWVtYmVyIGhvdyBtYW55IG9mIHRoZW0gd2UgZ290LlxuICAgIGNvbnN0IG5ld1Jlc3VsdENvdW50ID0gbG9jYWxSZXN1bHQucmVzdWx0cy5sZW5ndGg7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IHtcbiAgICAgICAgc2VhcmNoX2NhdGVnb3JpZXM6IHtcbiAgICAgICAgICAgIHJvb21fZXZlbnRzOiBsb2NhbFJlc3VsdCxcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0gY2xpZW50LnByb2Nlc3NSb29tRXZlbnRzU2VhcmNoKHNlYXJjaFJlc3VsdCwgcmVzcG9uc2UpO1xuXG4gICAgLy8gUmVzdG9yZSBvdXIgZW5jcnlwdGlvbiBpbmZvIHNvIHdlIGNhbiBwcm9wZXJseSByZS12ZXJpZnkgdGhlIGV2ZW50cy5cbiAgICBjb25zdCBuZXdTbGljZSA9IHJlc3VsdC5yZXN1bHRzLnNsaWNlKE1hdGgubWF4KHJlc3VsdC5yZXN1bHRzLmxlbmd0aCAtIG5ld1Jlc3VsdENvdW50LCAwKSk7XG4gICAgcmVzdG9yZUVuY3J5cHRpb25JbmZvKG5ld1NsaWNlKTtcblxuICAgIHNlYXJjaFJlc3VsdC5wZW5kaW5nUmVxdWVzdCA9IHVuZGVmaW5lZDtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVPbGRlc3RFdmVudHMoZmlyc3RSZXN1bHRzOiBJU2VhcmNoUmVzdWx0W10sIHNlY29uZFJlc3VsdHM6IElTZWFyY2hSZXN1bHRbXSk6IG51bWJlciB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb2xkZXN0Rmlyc3RFdmVudCA9IGZpcnN0UmVzdWx0c1tmaXJzdFJlc3VsdHMubGVuZ3RoIC0gMV0ucmVzdWx0O1xuICAgICAgICBjb25zdCBvbGRlc3RTZWNvbmRFdmVudCA9IHNlY29uZFJlc3VsdHNbc2Vjb25kUmVzdWx0cy5sZW5ndGggLSAxXS5yZXN1bHQ7XG5cbiAgICAgICAgaWYgKG9sZGVzdEZpcnN0RXZlbnQub3JpZ2luX3NlcnZlcl90cyA8PSBvbGRlc3RTZWNvbmRFdmVudC5vcmlnaW5fc2VydmVyX3RzKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNvbWJpbmVFdmVudFNvdXJjZXMoXG4gICAgcHJldmlvdXNTZWFyY2hSZXN1bHQ6IElTZXNoYXRTZWFyY2hSZXN1bHRzLFxuICAgIHJlc3BvbnNlOiBJUmVzdWx0Um9vbUV2ZW50cyxcbiAgICBhOiBJU2VhcmNoUmVzdWx0W10sXG4gICAgYjogSVNlYXJjaFJlc3VsdFtdLFxuKTogdm9pZCB7XG4gICAgLy8gTWVyZ2UgZXZlbnQgc291cmNlcyBhbmQgc29ydCB0aGUgZXZlbnRzLlxuICAgIGNvbnN0IGNvbWJpbmVkRXZlbnRzID0gYS5jb25jYXQoYikuc29ydChjb21wYXJlRXZlbnRzKTtcbiAgICAvLyBQdXQgaGFsZiBvZiB0aGUgZXZlbnRzIGluIHRoZSByZXNwb25zZSwgYW5kIGNhY2hlIHRoZSBvdGhlciBoYWxmLlxuICAgIHJlc3BvbnNlLnJlc3VsdHMgPSBjb21iaW5lZEV2ZW50cy5zbGljZSgwLCBTRUFSQ0hfTElNSVQpO1xuICAgIHByZXZpb3VzU2VhcmNoUmVzdWx0LmNhY2hlZEV2ZW50cyA9IGNvbWJpbmVkRXZlbnRzLnNsaWNlKFNFQVJDSF9MSU1JVCk7XG59XG5cbi8qKlxuICogQ29tYmluZSB0aGUgZXZlbnRzIGZyb20gb3VyIGV2ZW50IHNvdXJjZXMgaW50byBhIHNvcnRlZCByZXN1bHRcbiAqXG4gKiBUaGlzIG1ldGhvZCB3aWxsIGZpcnN0IGJlIGNhbGxlZCBmcm9tIHRoZSBjb21iaW5lZFNlYXJjaCgpIG1ldGhvZC4gSW4gdGhpc1xuICogY2FzZSB3ZSB3aWxsIGZldGNoIFNFQVJDSF9MSU1JVCBldmVudHMgZnJvbSB0aGUgc2VydmVyIGFuZCB0aGUgbG9jYWwgaW5kZXguXG4gKlxuICogVGhlIG1ldGhvZCB3aWxsIHB1dCB0aGUgU0VBUkNIX0xJTUlUIG5ld2VzdCBldmVudHMgZnJvbSB0aGUgc2VydmVyIGFuZCB0aGVcbiAqIGxvY2FsIGluZGV4IGluIHRoZSByZXN1bHRzIHBhcnQgb2YgdGhlIHJlc3BvbnNlLCB0aGUgcmVzdCB3aWxsIGJlIHB1dCBpbiB0aGVcbiAqIGNhY2hlZEV2ZW50cyBmaWVsZCBvZiB0aGUgcHJldmlvdXNTZWFyY2hSZXN1bHQgKGluIHRoaXMgY2FzZSBhbiBlbXB0eSBzZWFyY2hcbiAqIHJlc3VsdCkuXG4gKlxuICogRXZlcnkgc3Vic2VxdWVudCBjYWxsIHdpbGwgYmUgbWFkZSBmcm9tIHRoZSBjb21iaW5lZFBhZ2luYXRpb24oKSBtZXRob2QsIGluXG4gKiB0aGlzIGNhc2Ugd2Ugd2lsbCBjb21iaW5lIHRoZSBjYWNoZWRFdmVudHMgYW5kIHRoZSBuZXh0IFNFQVJDSF9MSU1JVCBldmVudHNcbiAqIGZyb20gZWl0aGVyIHRoZSBzZXJ2ZXIgb3IgdGhlIGxvY2FsIGluZGV4LlxuICpcbiAqIFNpbmNlIHdlIGhhdmUgdHdvIGV2ZW50IHNvdXJjZXMgYW5kIHdlIG5lZWQgdG8gc29ydCB0aGUgcmVzdWx0cyBieSBkYXRlIHdlXG4gKiBuZWVkIGtlZXAgb24gbG9va2luZyBmb3IgdGhlIG9sZGVzdCBldmVudC4gV2UgYXJlIGltcGxlbWVudGluZyBhIHZhcmlhdGlvbiBvZlxuICogYSBzbGlkaW5nIHdpbmRvdy5cbiAqXG4gKiBUaGUgZXZlbnQgc291cmNlcyBhcmUgaGVyZSByZXByZXNlbnRlZCBhcyB0d28gc29ydGVkIGxpc3RzIHdoZXJlIHRoZSBzbWFsbGVzdFxuICogbnVtYmVyIHJlcHJlc2VudHMgdGhlIG5ld2VzdCBldmVudC4gVGhlIHR3byBsaXN0cyBuZWVkIHRvIGJlIG1lcmdlZCBpbiBhIHdheVxuICogdGhhdCBwcmVzZXJ2ZXMgdGhlIHNvcnRlZCBwcm9wZXJ0eSBzbyB0aGV5IGNhbiBiZSBzaG93biBhcyBvbmUgc2VhcmNoIHJlc3VsdC5cbiAqIFdlIGZpcnN0IGZldGNoIFNFQVJDSF9MSU1JVCBldmVudHMgZnJvbSBib3RoIHNvdXJjZXMuXG4gKlxuICogSWYgd2Ugc2V0IFNFQVJDSF9MSU1JVCB0byAzOlxuICpcbiAqICBTZXJ2ZXIgZXZlbnRzIFswMSwgMDIsIDA0LCAwNiwgMDcsIDA4LCAxMSwgMTNdXG4gKiAgICAgICAgICAgICAgICB8MDEsIDAyLCAwNHxcbiAqICBMb2NhbCBldmVudHMgIFswMywgMDUsIDA5LCAxMCwgMTIsIDE0LCAxNSwgMTZdXG4gKiAgICAgICAgICAgICAgICB8MDMsIDA1LCAwOXxcbiAqXG4gKiAgV2Ugbm90ZSB0aGF0IHRoZSBvbGRlc3QgZXZlbnQgaXMgZnJvbSB0aGUgbG9jYWwgaW5kZXgsIGFuZCB3ZSBjb21iaW5lIHRoZVxuICogIHJlc3VsdHM6XG4gKlxuICogIFNlcnZlciB3aW5kb3cgWzAxLCAwMiwgMDRdXG4gKiAgTG9jYWwgd2luZG93ICBbMDMsIDA1LCAwOV1cbiAqXG4gKiAgQ29tYmluZWQgZXZlbnRzIFswMSwgMDIsIDAzLCAwNCwgMDUsIDA5XVxuICpcbiAqICBXZSBzcGxpdCB0aGUgY29tYmluZWQgcmVzdWx0IGluIHRoZSBwYXJ0IHRoYXQgd2Ugd2FudCB0byBwcmVzZW50IGFuZCBhIHBhcnRcbiAqICB0aGF0IHdpbGwgYmUgY2FjaGVkLlxuICpcbiAqICBQcmVzZW50ZWQgZXZlbnRzIFswMSwgMDIsIDAzXVxuICogIENhY2hlZCBldmVudHMgICAgWzA0LCAwNSwgMDldXG4gKlxuICogIFdlIHNsaWRlIHRoZSB3aW5kb3cgZm9yIHRoZSBzZXJ2ZXIgc2luY2UgdGhlIG9sZGVzdCBldmVudCBpcyBmcm9tIHRoZSBsb2NhbFxuICogIGluZGV4LlxuICpcbiAqICBTZXJ2ZXIgZXZlbnRzIFswMSwgMDIsIDA0LCAwNiwgMDcsIDA4LCAxMSwgMTNdXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICB8MDYsIDA3LCAwOHxcbiAqICBMb2NhbCBldmVudHMgIFswMywgMDUsIDA5LCAxMCwgMTIsIDE0LCAxNSwgMTZdXG4gKiAgICAgICAgICAgICAgICB8WFgsIFhYLCBYWHxcbiAqICBDYWNoZWQgZXZlbnRzIFswNCwgMDUsIDA5XVxuICpcbiAqICBXZSBub3RlIHRoYXQgdGhlIG9sZGVzdCBldmVudCBpcyBmcm9tIHRoZSBzZXJ2ZXIgYW5kIHdlIGNvbWJpbmUgdGhlIG5ld1xuICogIHNlcnZlciBldmVudHMgd2l0aCB0aGUgY2FjaGVkIG9uZXMuXG4gKlxuICogIENhY2hlZCBldmVudHMgWzA0LCAwNSwgMDldXG4gKiAgU2VydmVyIGV2ZW50cyBbMDYsIDA3LCAwOF1cbiAqXG4gKiAgQ29tYmluZWQgZXZlbnRzIFswNCwgMDUsIDA2LCAwNywgMDgsIDA5XVxuICpcbiAqICBXZSBzcGxpdCBhZ2Fpbi5cbiAqXG4gKiAgUHJlc2VudGVkIGV2ZW50cyBbMDQsIDA1LCAwNl1cbiAqICBDYWNoZWQgZXZlbnRzICAgIFswNywgMDgsIDA5XVxuICpcbiAqICBXZSBzbGlkZSB0aGUgbG9jYWwgd2luZG93LCB0aGUgb2xkZXN0IGV2ZW50IGlzIG9uIHRoZSBzZXJ2ZXIuXG4gKlxuICogIFNlcnZlciBldmVudHMgWzAxLCAwMiwgMDQsIDA2LCAwNywgMDgsIDExLCAxM11cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxYWCwgWFgsIFhYfFxuICogIExvY2FsIGV2ZW50cyAgWzAzLCAwNSwgMDksIDEwLCAxMiwgMTQsIDE1LCAxNl1cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwxMCwgMTIsIDE0fFxuICpcbiAqICBDYWNoZWQgZXZlbnRzIFswNywgMDgsIDA5XVxuICogIExvY2FsIGV2ZW50cyAgWzEwLCAxMiwgMTRdXG4gKiAgQ29tYmluZWQgZXZlbnRzIFswNywgMDgsIDA5LCAxMCwgMTIsIDE0XVxuICpcbiAqICBQcmVzZW50ZWQgZXZlbnRzIFswNywgMDgsIDA5XVxuICogIENhY2hlZCBldmVudHMgICAgWzEwLCAxMiwgMTRdXG4gKlxuICogIE5leHQgdXAgd2Ugc2xpZGUgdGhlIHNlcnZlciB3aW5kb3cgYWdhaW4uXG4gKlxuICogIFNlcnZlciBldmVudHMgWzAxLCAwMiwgMDQsIDA2LCAwNywgMDgsIDExLCAxM11cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwxMSwgMTN8XG4gKiAgTG9jYWwgZXZlbnRzICBbMDMsIDA1LCAwOSwgMTAsIDEyLCAxNCwgMTUsIDE2XVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgfFhYLCBYWCwgWFh8XG4gKlxuICogIENhY2hlZCBldmVudHMgWzEwLCAxMiwgMTRdXG4gKiAgU2VydmVyIGV2ZW50cyBbMTEsIDEzXVxuICogIENvbWJpbmVkIGV2ZW50cyBbMTAsIDExLCAxMiwgMTMsIDE0XVxuICpcbiAqICBQcmVzZW50ZWQgZXZlbnRzIFsxMCwgMTEsIDEyXVxuICogIENhY2hlZCBldmVudHMgICAgWzEzLCAxNF1cbiAqXG4gKiAgV2UgaGF2ZSBvbmUgc291cmNlIGV4aGF1c3RlZCwgd2UgZmV0Y2ggdGhlIHJlc3Qgb2Ygb3VyIGV2ZW50cyBmcm9tIHRoZSBvdGhlclxuICogIHNvdXJjZSBhbmQgY29tYmluZSBpdCB3aXRoIG91ciBjYWNoZWQgZXZlbnRzLlxuICpcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gcHJldmlvdXNTZWFyY2hSZXN1bHQgQSBzZWFyY2ggcmVzdWx0IGZyb20gYSBwcmV2aW91cyBzZWFyY2hcbiAqIGNhbGwuXG4gKiBAcGFyYW0ge29iamVjdH0gbG9jYWxFdmVudHMgQW4gdW5wcm9jZXNzZWQgc2VhcmNoIHJlc3VsdCBmcm9tIHRoZSBldmVudFxuICogaW5kZXguXG4gKiBAcGFyYW0ge29iamVjdH0gc2VydmVyRXZlbnRzIEFuIHVucHJvY2Vzc2VkIHNlYXJjaCByZXN1bHQgZnJvbSB0aGUgc2VydmVyLlxuICpcbiAqIEByZXR1cm4ge29iamVjdH0gQSByZXNwb25zZSBvYmplY3QgdGhhdCBjb21iaW5lcyB0aGUgZXZlbnRzIGZyb20gdGhlXG4gKiBkaWZmZXJlbnQgZXZlbnQgc291cmNlcy5cbiAqXG4gKi9cbmZ1bmN0aW9uIGNvbWJpbmVFdmVudHMoXG4gICAgcHJldmlvdXNTZWFyY2hSZXN1bHQ6IElTZXNoYXRTZWFyY2hSZXN1bHRzLFxuICAgIGxvY2FsRXZlbnRzPzogSVJlc3VsdFJvb21FdmVudHMsXG4gICAgc2VydmVyRXZlbnRzPzogSVJlc3VsdFJvb21FdmVudHMsXG4pOiBJUmVzdWx0Um9vbUV2ZW50cyB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSB7fSBhcyBJUmVzdWx0Um9vbUV2ZW50cztcblxuICAgIGNvbnN0IGNhY2hlZEV2ZW50cyA9IHByZXZpb3VzU2VhcmNoUmVzdWx0LmNhY2hlZEV2ZW50cztcbiAgICBsZXQgb2xkZXN0RXZlbnRGcm9tID0gcHJldmlvdXNTZWFyY2hSZXN1bHQub2xkZXN0RXZlbnRGcm9tO1xuICAgIHJlc3BvbnNlLmhpZ2hsaWdodHMgPSBwcmV2aW91c1NlYXJjaFJlc3VsdC5oaWdobGlnaHRzO1xuXG4gICAgaWYgKGxvY2FsRXZlbnRzICYmIHNlcnZlckV2ZW50cyAmJiBzZXJ2ZXJFdmVudHMucmVzdWx0cykge1xuICAgICAgICAvLyBUaGlzIGlzIGEgZmlyc3Qgc2VhcmNoIGNhbGwsIGNvbWJpbmUgdGhlIGV2ZW50cyBmcm9tIHRoZSBzZXJ2ZXIgYW5kXG4gICAgICAgIC8vIHRoZSBsb2NhbCBpbmRleC4gTm90ZSB3aGVyZSBvdXIgb2xkZXN0IGV2ZW50IGNhbWUgZnJvbSwgd2Ugc2hhbGxcbiAgICAgICAgLy8gZmV0Y2ggdGhlIG5leHQgYmF0Y2ggb2YgZXZlbnRzIGZyb20gdGhlIG90aGVyIHNvdXJjZS5cbiAgICAgICAgaWYgKGNvbXBhcmVPbGRlc3RFdmVudHMobG9jYWxFdmVudHMucmVzdWx0cywgc2VydmVyRXZlbnRzLnJlc3VsdHMpIDwgMCkge1xuICAgICAgICAgICAgb2xkZXN0RXZlbnRGcm9tID0gXCJsb2NhbFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tYmluZUV2ZW50U291cmNlcyhwcmV2aW91c1NlYXJjaFJlc3VsdCwgcmVzcG9uc2UsIGxvY2FsRXZlbnRzLnJlc3VsdHMsIHNlcnZlckV2ZW50cy5yZXN1bHRzKTtcbiAgICAgICAgcmVzcG9uc2UuaGlnaGxpZ2h0cyA9IGxvY2FsRXZlbnRzLmhpZ2hsaWdodHMuY29uY2F0KHNlcnZlckV2ZW50cy5oaWdobGlnaHRzKTtcbiAgICB9IGVsc2UgaWYgKGxvY2FsRXZlbnRzKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSBwYWdpbmF0aW9uIGNhbGwgZmV0Y2hpbmcgbW9yZSBldmVudHMgZnJvbSB0aGUgbG9jYWwgaW5kZXgsXG4gICAgICAgIC8vIG1lYW5pbmcgdGhhdCBvdXIgb2xkZXN0IGV2ZW50IHdhcyBvbiB0aGUgc2VydmVyLlxuICAgICAgICAvLyBDaGFuZ2UgdGhlIHNvdXJjZSBvZiB0aGUgb2xkZXN0IGV2ZW50IGlmIG91ciBsb2NhbCBldmVudCBpcyBvbGRlclxuICAgICAgICAvLyB0aGFuIHRoZSBjYWNoZWQgb25lLlxuICAgICAgICBpZiAoY29tcGFyZU9sZGVzdEV2ZW50cyhsb2NhbEV2ZW50cy5yZXN1bHRzLCBjYWNoZWRFdmVudHMpIDwgMCkge1xuICAgICAgICAgICAgb2xkZXN0RXZlbnRGcm9tID0gXCJsb2NhbFwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbWJpbmVFdmVudFNvdXJjZXMocHJldmlvdXNTZWFyY2hSZXN1bHQsIHJlc3BvbnNlLCBsb2NhbEV2ZW50cy5yZXN1bHRzLCBjYWNoZWRFdmVudHMpO1xuICAgIH0gZWxzZSBpZiAoc2VydmVyRXZlbnRzICYmIHNlcnZlckV2ZW50cy5yZXN1bHRzKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSBwYWdpbmF0aW9uIGNhbGwgZmV0Y2hpbmcgbW9yZSBldmVudHMgZnJvbSB0aGUgc2VydmVyLFxuICAgICAgICAvLyBtZWFuaW5nIHRoYXQgb3VyIG9sZGVzdCBldmVudCB3YXMgaW4gdGhlIGxvY2FsIGluZGV4LlxuICAgICAgICAvLyBDaGFuZ2UgdGhlIHNvdXJjZSBvZiB0aGUgb2xkZXN0IGV2ZW50IGlmIG91ciBzZXJ2ZXIgZXZlbnQgaXMgb2xkZXJcbiAgICAgICAgLy8gdGhhbiB0aGUgY2FjaGVkIG9uZS5cbiAgICAgICAgaWYgKGNvbXBhcmVPbGRlc3RFdmVudHMoc2VydmVyRXZlbnRzLnJlc3VsdHMsIGNhY2hlZEV2ZW50cykgPCAwKSB7XG4gICAgICAgICAgICBvbGRlc3RFdmVudEZyb20gPSBcInNlcnZlclwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbWJpbmVFdmVudFNvdXJjZXMocHJldmlvdXNTZWFyY2hSZXN1bHQsIHJlc3BvbnNlLCBzZXJ2ZXJFdmVudHMucmVzdWx0cywgY2FjaGVkRXZlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIGlzIGEgcGFnaW5hdGlvbiBjYWxsIHdoZXJlIHdlIGV4aGF1c3RlZCBib3RoIG9mIG91ciBldmVudFxuICAgICAgICAvLyBzb3VyY2VzLCBsZXQncyBwdXNoIHRoZSByZW1haW5pbmcgY2FjaGVkIGV2ZW50cy5cbiAgICAgICAgcmVzcG9uc2UucmVzdWx0cyA9IGNhY2hlZEV2ZW50cztcbiAgICAgICAgcHJldmlvdXNTZWFyY2hSZXN1bHQuY2FjaGVkRXZlbnRzID0gW107XG4gICAgfVxuXG4gICAgcHJldmlvdXNTZWFyY2hSZXN1bHQub2xkZXN0RXZlbnRGcm9tID0gb2xkZXN0RXZlbnRGcm9tO1xuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xufVxuXG4vKipcbiAqIENvbWJpbmUgdGhlIGxvY2FsIGFuZCBzZXJ2ZXIgc2VhcmNoIHJlc3BvbnNlc1xuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBwcmV2aW91c1NlYXJjaFJlc3VsdCBBIHNlYXJjaCByZXN1bHQgZnJvbSBhIHByZXZpb3VzIHNlYXJjaFxuICogY2FsbC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBsb2NhbEV2ZW50cyBBbiB1bnByb2Nlc3NlZCBzZWFyY2ggcmVzdWx0IGZyb20gdGhlIGV2ZW50XG4gKiBpbmRleC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBzZXJ2ZXJFdmVudHMgQW4gdW5wcm9jZXNzZWQgc2VhcmNoIHJlc3VsdCBmcm9tIHRoZSBzZXJ2ZXIuXG4gKlxuICogQHJldHVybiB7b2JqZWN0fSBBIHJlc3BvbnNlIG9iamVjdCB0aGF0IGNvbWJpbmVzIHRoZSBldmVudHMgZnJvbSB0aGVcbiAqIGRpZmZlcmVudCBldmVudCBzb3VyY2VzLlxuICovXG5mdW5jdGlvbiBjb21iaW5lUmVzcG9uc2VzKFxuICAgIHByZXZpb3VzU2VhcmNoUmVzdWx0OiBJU2VzaGF0U2VhcmNoUmVzdWx0cyxcbiAgICBsb2NhbEV2ZW50czogSVJlc3VsdFJvb21FdmVudHMsXG4gICAgc2VydmVyRXZlbnRzOiBJUmVzdWx0Um9vbUV2ZW50cyxcbik6IElSZXN1bHRSb29tRXZlbnRzIHtcbiAgICAvLyBDb21iaW5lIG91ciBldmVudHMgZmlyc3QuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBjb21iaW5lRXZlbnRzKHByZXZpb3VzU2VhcmNoUmVzdWx0LCBsb2NhbEV2ZW50cywgc2VydmVyRXZlbnRzKTtcblxuICAgIC8vIE91ciBmaXJzdCBzZWFyY2ggd2lsbCBjb250YWluIGNvdW50cyBmcm9tIGJvdGggc291cmNlcywgc3Vic2VxdWVudFxuICAgIC8vIHBhZ2luYXRpb24gcmVxdWVzdHMgd2lsbCBmZXRjaCByZXNwb25zZXMgb25seSBmcm9tIG9uZSBvZiB0aGUgc291cmNlcywgc29cbiAgICAvLyByZXVzZSB0aGUgZmlyc3QgY291bnQgd2hlbiB3ZSdyZSBwYWdpbmF0aW5nLlxuICAgIGlmIChwcmV2aW91c1NlYXJjaFJlc3VsdC5jb3VudCkge1xuICAgICAgICByZXNwb25zZS5jb3VudCA9IHByZXZpb3VzU2VhcmNoUmVzdWx0LmNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3BvbnNlLmNvdW50ID0gbG9jYWxFdmVudHMuY291bnQgKyBzZXJ2ZXJFdmVudHMuY291bnQ7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIG91ciBuZXh0IGJhdGNoIHRva2VucyBmb3IgdGhlIGdpdmVuIHNlYXJjaCBzb3VyY2VzLlxuICAgIGlmIChsb2NhbEV2ZW50cykge1xuICAgICAgICBwcmV2aW91c1NlYXJjaFJlc3VsdC5zZXNoYXRRdWVyeS5uZXh0X2JhdGNoID0gbG9jYWxFdmVudHMubmV4dF9iYXRjaDtcbiAgICB9XG4gICAgaWYgKHNlcnZlckV2ZW50cykge1xuICAgICAgICBwcmV2aW91c1NlYXJjaFJlc3VsdC5zZXJ2ZXJTaWRlTmV4dEJhdGNoID0gc2VydmVyRXZlbnRzLm5leHRfYmF0Y2g7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSByZXNwb25zZSBuZXh0IGJhdGNoIHRva2VuIHRvIG9uZSBvZiB0aGUgdG9rZW5zIGZyb20gdGhlIHNvdXJjZXMsXG4gICAgLy8gdGhpcyBtYWtlcyBzdXJlIHRoYXQgaWYgd2UgZXhoYXVzdCBvbmUgb2YgdGhlIHNvdXJjZXMgd2UgY29udGludWUgd2l0aFxuICAgIC8vIHRoZSBvdGhlciBvbmUuXG4gICAgaWYgKHByZXZpb3VzU2VhcmNoUmVzdWx0LnNlc2hhdFF1ZXJ5Py5uZXh0X2JhdGNoKSB7XG4gICAgICAgIHJlc3BvbnNlLm5leHRfYmF0Y2ggPSBwcmV2aW91c1NlYXJjaFJlc3VsdC5zZXNoYXRRdWVyeS5uZXh0X2JhdGNoO1xuICAgIH0gZWxzZSBpZiAocHJldmlvdXNTZWFyY2hSZXN1bHQuc2VydmVyU2lkZU5leHRCYXRjaCkge1xuICAgICAgICByZXNwb25zZS5uZXh0X2JhdGNoID0gcHJldmlvdXNTZWFyY2hSZXN1bHQuc2VydmVyU2lkZU5leHRCYXRjaDtcbiAgICB9XG5cbiAgICAvLyBXZSBjb2xsZWN0ZWQgYWxsIHNlYXJjaCByZXN1bHRzIGZyb20gdGhlIHNlcnZlciBhcyB3ZWxsIGFzIGZyb20gU2VzaGF0LFxuICAgIC8vIHdlIHN0aWxsIGhhdmUgc29tZSBldmVudHMgY2FjaGVkIHRoYXQgd2UnbGwgd2FudCB0byBkaXNwbGF5IG9uIHRoZSBuZXh0XG4gICAgLy8gcGFnaW5hdGlvbiByZXF1ZXN0LlxuICAgIC8vXG4gICAgLy8gUHJvdmlkZSBhIGZha2UgbmV4dCBiYXRjaCB0b2tlbiBmb3IgdGhhdCBjYXNlLlxuICAgIGlmICghcmVzcG9uc2UubmV4dF9iYXRjaCAmJiBwcmV2aW91c1NlYXJjaFJlc3VsdC5jYWNoZWRFdmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICByZXNwb25zZS5uZXh0X2JhdGNoID0gXCJjYWNoZWRcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzcG9uc2U7XG59XG5cbmludGVyZmFjZSBJRW5jcnlwdGVkU2VzaGF0RXZlbnQge1xuICAgIGN1cnZlMjU1MTlLZXk/OiBzdHJpbmc7XG4gICAgZWQyNTUxOUtleT86IHN0cmluZztcbiAgICBhbGdvcml0aG0/OiBzdHJpbmc7XG4gICAgZm9yd2FyZGluZ0N1cnZlMjU1MTlLZXlDaGFpbj86IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiByZXN0b3JlRW5jcnlwdGlvbkluZm8oc2VhcmNoUmVzdWx0U2xpY2U6IFNlYXJjaFJlc3VsdFtdID0gW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBzZWFyY2hSZXN1bHRTbGljZSkge1xuICAgICAgICBjb25zdCB0aW1lbGluZSA9IHJlc3VsdC5jb250ZXh0LmdldFRpbWVsaW5lKCk7XG5cbiAgICAgICAgZm9yIChjb25zdCBteEV2IG9mIHRpbWVsaW5lKSB7XG4gICAgICAgICAgICBjb25zdCBldiA9IG14RXYuZXZlbnQgYXMgSUVuY3J5cHRlZFNlc2hhdEV2ZW50O1xuXG4gICAgICAgICAgICBpZiAoZXYuY3VydmUyNTUxOUtleSkge1xuICAgICAgICAgICAgICAgIG14RXYubWFrZUVuY3J5cHRlZChcbiAgICAgICAgICAgICAgICAgICAgRXZlbnRUeXBlLlJvb21NZXNzYWdlRW5jcnlwdGVkLFxuICAgICAgICAgICAgICAgICAgICB7IGFsZ29yaXRobTogZXYuYWxnb3JpdGhtIH0sXG4gICAgICAgICAgICAgICAgICAgIGV2LmN1cnZlMjU1MTlLZXksXG4gICAgICAgICAgICAgICAgICAgIGV2LmVkMjU1MTlLZXkhLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgIG14RXYuZm9yd2FyZGluZ0N1cnZlMjU1MTlLZXlDaGFpbiA9IGV2LmZvcndhcmRpbmdDdXJ2ZTI1NTE5S2V5Q2hhaW47XG5cbiAgICAgICAgICAgICAgICBkZWxldGUgZXYuY3VydmUyNTUxOUtleTtcbiAgICAgICAgICAgICAgICBkZWxldGUgZXYuZWQyNTUxOUtleTtcbiAgICAgICAgICAgICAgICBkZWxldGUgZXYuYWxnb3JpdGhtO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBldi5mb3J3YXJkaW5nQ3VydmUyNTUxOUtleUNoYWluO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjb21iaW5lZFBhZ2luYXRpb24oXG4gICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgc2VhcmNoUmVzdWx0OiBJU2VzaGF0U2VhcmNoUmVzdWx0cyxcbik6IFByb21pc2U8SVNlc2hhdFNlYXJjaFJlc3VsdHM+IHtcbiAgICBjb25zdCBldmVudEluZGV4ID0gRXZlbnRJbmRleFBlZy5nZXQoKTtcblxuICAgIGNvbnN0IHNlYXJjaEFyZ3MgPSBzZWFyY2hSZXN1bHQuc2VzaGF0UXVlcnk7XG4gICAgY29uc3Qgb2xkZXN0RXZlbnRGcm9tID0gc2VhcmNoUmVzdWx0Lm9sZGVzdEV2ZW50RnJvbTtcblxuICAgIGxldCBsb2NhbFJlc3VsdDogSVJlc3VsdFJvb21FdmVudHMgfCB1bmRlZmluZWQ7XG4gICAgbGV0IHNlcnZlclNpZGVSZXN1bHQ6IElTZWFyY2hSZXNwb25zZSB8IHVuZGVmaW5lZDtcblxuICAgIC8vIEZldGNoIGV2ZW50cyBmcm9tIHRoZSBsb2NhbCBpbmRleCBpZiB3ZSBoYXZlIGEgdG9rZW4gZm9yIGl0IGFuZCBpZiBpdCdzXG4gICAgLy8gdGhlIGxvY2FsIGluZGV4ZXMgdHVybiBvciB0aGUgc2VydmVyIGhhcyBleGhhdXN0ZWQgaXRzIHJlc3VsdHMuXG4gICAgaWYgKHNlYXJjaEFyZ3M/Lm5leHRfYmF0Y2ggJiYgKCFzZWFyY2hSZXN1bHQuc2VydmVyU2lkZU5leHRCYXRjaCB8fCBvbGRlc3RFdmVudEZyb20gPT09IFwic2VydmVyXCIpKSB7XG4gICAgICAgIGxvY2FsUmVzdWx0ID0gYXdhaXQgZXZlbnRJbmRleCEuc2VhcmNoKHNlYXJjaEFyZ3MpO1xuICAgIH1cblxuICAgIC8vIEZldGNoIGV2ZW50cyBmcm9tIHRoZSBzZXJ2ZXIgaWYgd2UgaGF2ZSBhIHRva2VuIGZvciBpdCBhbmQgaWYgaXQncyB0aGVcbiAgICAvLyBsb2NhbCBpbmRleGVzIHR1cm4gb3IgdGhlIGxvY2FsIGluZGV4IGhhcyBleGhhdXN0ZWQgaXRzIHJlc3VsdHMuXG4gICAgaWYgKHNlYXJjaFJlc3VsdC5zZXJ2ZXJTaWRlTmV4dEJhdGNoICYmIChvbGRlc3RFdmVudEZyb20gPT09IFwibG9jYWxcIiB8fCAhc2VhcmNoQXJncy5uZXh0X2JhdGNoKSkge1xuICAgICAgICBjb25zdCBib2R5ID0geyBib2R5OiBzZWFyY2hSZXN1bHQuX3F1ZXJ5LCBuZXh0X2JhdGNoOiBzZWFyY2hSZXN1bHQuc2VydmVyU2lkZU5leHRCYXRjaCB9O1xuICAgICAgICBzZXJ2ZXJTaWRlUmVzdWx0ID0gYXdhaXQgY2xpZW50LnNlYXJjaChib2R5KTtcbiAgICB9XG5cbiAgICBsZXQgc2VydmVyRXZlbnRzOiBJUmVzdWx0Um9vbUV2ZW50cyB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChzZXJ2ZXJTaWRlUmVzdWx0KSB7XG4gICAgICAgIHNlcnZlckV2ZW50cyA9IHNlcnZlclNpZGVSZXN1bHQuc2VhcmNoX2NhdGVnb3JpZXMucm9vbV9ldmVudHM7XG4gICAgfVxuXG4gICAgLy8gQ29tYmluZSBvdXIgZXZlbnRzLlxuICAgIGNvbnN0IGNvbWJpbmVkUmVzdWx0ID0gY29tYmluZVJlc3BvbnNlcyhzZWFyY2hSZXN1bHQsIGxvY2FsUmVzdWx0LCBzZXJ2ZXJFdmVudHMpO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSB7XG4gICAgICAgIHNlYXJjaF9jYXRlZ29yaWVzOiB7XG4gICAgICAgICAgICByb29tX2V2ZW50czogY29tYmluZWRSZXN1bHQsXG4gICAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IG9sZFJlc3VsdENvdW50ID0gc2VhcmNoUmVzdWx0LnJlc3VsdHMgPyBzZWFyY2hSZXN1bHQucmVzdWx0cy5sZW5ndGggOiAwO1xuXG4gICAgLy8gTGV0IHRoZSBjbGllbnQgcHJvY2VzcyB0aGUgY29tYmluZWQgcmVzdWx0LlxuICAgIGNvbnN0IHJlc3VsdCA9IGNsaWVudC5wcm9jZXNzUm9vbUV2ZW50c1NlYXJjaChzZWFyY2hSZXN1bHQsIHJlc3BvbnNlKTtcblxuICAgIC8vIFJlc3RvcmUgb3VyIGVuY3J5cHRpb24gaW5mbyBzbyB3ZSBjYW4gcHJvcGVybHkgcmUtdmVyaWZ5IHRoZSBldmVudHMuXG4gICAgY29uc3QgbmV3UmVzdWx0Q291bnQgPSByZXN1bHQucmVzdWx0cy5sZW5ndGggLSBvbGRSZXN1bHRDb3VudDtcbiAgICBjb25zdCBuZXdTbGljZSA9IHJlc3VsdC5yZXN1bHRzLnNsaWNlKE1hdGgubWF4KHJlc3VsdC5yZXN1bHRzLmxlbmd0aCAtIG5ld1Jlc3VsdENvdW50LCAwKSk7XG4gICAgcmVzdG9yZUVuY3J5cHRpb25JbmZvKG5ld1NsaWNlKTtcblxuICAgIHNlYXJjaFJlc3VsdC5wZW5kaW5nUmVxdWVzdCA9IHVuZGVmaW5lZDtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGV2ZW50SW5kZXhTZWFyY2goXG4gICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgdGVybTogc3RyaW5nLFxuICAgIHJvb21JZD86IHN0cmluZyxcbiAgICBhYm9ydFNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0cz4ge1xuICAgIGxldCBzZWFyY2hQcm9taXNlOiBQcm9taXNlPElTZWFyY2hSZXN1bHRzPjtcblxuICAgIGlmIChyb29tSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoY2xpZW50LmlzUm9vbUVuY3J5cHRlZChyb29tSWQpKSB7XG4gICAgICAgICAgICAvLyBUaGUgc2VhcmNoIGlzIGZvciBhIHNpbmdsZSBlbmNyeXB0ZWQgcm9vbSwgdXNlIG91ciBsb2NhbFxuICAgICAgICAgICAgLy8gc2VhcmNoIG1ldGhvZC5cbiAgICAgICAgICAgIHNlYXJjaFByb21pc2UgPSBsb2NhbFNlYXJjaFByb2Nlc3MoY2xpZW50LCB0ZXJtLCByb29tSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhlIHNlYXJjaCBpcyBmb3IgYSBzaW5nbGUgbm9uLWVuY3J5cHRlZCByb29tLCB1c2UgdGhlXG4gICAgICAgICAgICAvLyBzZXJ2ZXItc2lkZSBzZWFyY2guXG4gICAgICAgICAgICBzZWFyY2hQcm9taXNlID0gc2VydmVyU2lkZVNlYXJjaFByb2Nlc3MoY2xpZW50LCB0ZXJtLCByb29tSWQsIGFib3J0U2lnbmFsKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNlYXJjaCBhY3Jvc3MgYWxsIHJvb21zLCBjb21iaW5lIGEgc2VydmVyIHNpZGUgc2VhcmNoIGFuZCBhXG4gICAgICAgIC8vIGxvY2FsIHNlYXJjaC5cbiAgICAgICAgc2VhcmNoUHJvbWlzZSA9IGNvbWJpbmVkU2VhcmNoKGNsaWVudCwgdGVybSwgYWJvcnRTaWduYWwpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWFyY2hQcm9taXNlO1xufVxuXG5mdW5jdGlvbiBldmVudEluZGV4U2VhcmNoUGFnaW5hdGlvbihcbiAgICBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICBzZWFyY2hSZXN1bHQ6IElTZXNoYXRTZWFyY2hSZXN1bHRzLFxuKTogUHJvbWlzZTxJU2VzaGF0U2VhcmNoUmVzdWx0cz4ge1xuICAgIGNvbnN0IHNlc2hhdFF1ZXJ5ID0gc2VhcmNoUmVzdWx0LnNlc2hhdFF1ZXJ5O1xuICAgIGNvbnN0IHNlcnZlclF1ZXJ5ID0gc2VhcmNoUmVzdWx0Ll9xdWVyeTtcblxuICAgIGlmICghc2VzaGF0UXVlcnkpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhIHNlYXJjaCBpbiBhIG5vbi1lbmNyeXB0ZWQgcm9vbS4gRG8gdGhlIG5vcm1hbCBzZXJ2ZXItc2lkZVxuICAgICAgICAvLyBwYWdpbmF0aW9uLlxuICAgICAgICByZXR1cm4gY2xpZW50LmJhY2tQYWdpbmF0ZVJvb21FdmVudHNTZWFyY2goc2VhcmNoUmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKCFzZXJ2ZXJRdWVyeSkge1xuICAgICAgICAvLyBUaGlzIGlzIGEgc2VhcmNoIGluIGEgZW5jcnlwdGVkIHJvb20uIERvIGEgbG9jYWwgcGFnaW5hdGlvbi5cbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IGxvY2FsUGFnaW5hdGlvbihjbGllbnQsIHNlYXJjaFJlc3VsdCk7XG4gICAgICAgIHNlYXJjaFJlc3VsdC5wZW5kaW5nUmVxdWVzdCA9IHByb21pc2U7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2UgaGF2ZSBib3RoIHF1ZXJpZXMgYXJvdW5kLCB0aGlzIGlzIGEgc2VhcmNoIGFjcm9zcyBhbGwgcm9vbXMgc28gYVxuICAgICAgICAvLyBjb21iaW5lZCBwYWdpbmF0aW9uIG5lZWRzIHRvIGJlIGRvbmUuXG4gICAgICAgIGNvbnN0IHByb21pc2UgPSBjb21iaW5lZFBhZ2luYXRpb24oY2xpZW50LCBzZWFyY2hSZXN1bHQpO1xuICAgICAgICBzZWFyY2hSZXN1bHQucGVuZGluZ1JlcXVlc3QgPSBwcm9taXNlO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlYXJjaFBhZ2luYXRpb24oY2xpZW50OiBNYXRyaXhDbGllbnQsIHNlYXJjaFJlc3VsdDogSVNlYXJjaFJlc3VsdHMpOiBQcm9taXNlPElTZWFyY2hSZXN1bHRzPiB7XG4gICAgY29uc3QgZXZlbnRJbmRleCA9IEV2ZW50SW5kZXhQZWcuZ2V0KCk7XG5cbiAgICBpZiAoc2VhcmNoUmVzdWx0LnBlbmRpbmdSZXF1ZXN0KSByZXR1cm4gc2VhcmNoUmVzdWx0LnBlbmRpbmdSZXF1ZXN0O1xuXG4gICAgaWYgKGV2ZW50SW5kZXggPT09IG51bGwpIHJldHVybiBjbGllbnQuYmFja1BhZ2luYXRlUm9vbUV2ZW50c1NlYXJjaChzZWFyY2hSZXN1bHQpO1xuICAgIGVsc2UgcmV0dXJuIGV2ZW50SW5kZXhTZWFyY2hQYWdpbmF0aW9uKGNsaWVudCwgc2VhcmNoUmVzdWx0KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZXZlbnRTZWFyY2goXG4gICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgdGVybTogc3RyaW5nLFxuICAgIHJvb21JZD86IHN0cmluZyxcbiAgICBhYm9ydFNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0cz4ge1xuICAgIGNvbnN0IGV2ZW50SW5kZXggPSBFdmVudEluZGV4UGVnLmdldCgpO1xuXG4gICAgaWYgKGV2ZW50SW5kZXggPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHNlcnZlclNpZGVTZWFyY2hQcm9jZXNzKGNsaWVudCwgdGVybSwgcm9vbUlkLCBhYm9ydFNpZ25hbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGV2ZW50SW5kZXhTZWFyY2goY2xpZW50LCB0ZXJtLCByb29tSWQsIGFib3J0U2lnbmFsKTtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBZ0JBLElBQUFBLE9BQUEsR0FBQUMsT0FBQTtBQVNBLElBQUFDLE1BQUEsR0FBQUQsT0FBQTtBQUtBLElBQUFFLGNBQUEsR0FBQUMsc0JBQUEsQ0FBQUgsT0FBQTtBQTlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBa0JBLE1BQU1JLFlBQVksR0FBRyxFQUFFO0FBRXZCLGVBQWVDLGdCQUFnQkEsQ0FDM0JDLE1BQW9CLEVBQ3BCQyxJQUFZLEVBQ1pDLE1BQWUsRUFDZkMsV0FBeUIsRUFDd0M7RUFDakUsTUFBTUMsTUFBd0IsR0FBRztJQUM3QkMsS0FBSyxFQUFFUDtFQUNYLENBQUM7RUFF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