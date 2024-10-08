"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

// The following interfaces take their names and member names from seshat and the spec
/* eslint-disable camelcase */

/**
 * Base class for classes that provide platform-specific event indexing.
 *
 * Instances of this class are provided by the application.
 */
class BaseEventIndexManager {
  /**
   * Does our EventIndexManager support event indexing.
   *
   * If an EventIndexManager implementor has runtime dependencies that
   * optionally enable event indexing they may override this method to perform
   * the necessary runtime checks here.
   *
   * @return {Promise} A promise that will resolve to true if event indexing
   * is supported, false otherwise.
   */
  async supportsEventIndexing() {
    return true;
  }
  /**
   * Initialize the event index for the given user.
   *
   * @param {string} userId The event that should be added to the index.
   * @param {string} deviceId The profile of the event sender at the
   *
   * @return {Promise} A promise that will resolve when the event index is
   * initialized.
   */
  async initEventIndex(userId, deviceId) {
    throw new Error("Unimplemented");
  }

  /**
   * Queue up an event to be added to the index.
   *
   * @param {MatrixEvent} ev The event that should be added to the index.
   * @param {IMatrixProfile} profile The profile of the event sender at the
   * time the event was received.
   *
   * @return {Promise} A promise that will resolve when the was queued up for
   * addition.
   */
  async addEventToIndex(ev, profile) {
    throw new Error("Unimplemented");
  }
  async deleteEvent(eventId) {
    throw new Error("Unimplemented");
  }
  async isEventIndexEmpty() {
    throw new Error("Unimplemented");
  }

  /**
   * Check if our event index is empty.
   */
  indexIsEmpty() {
    throw new Error("Unimplemented");
  }

  /**
   * Check if the room with the given id is already indexed.
   *
   * @param {string} roomId The ID of the room which we want to check if it
   * has been already indexed.
   *
   * @return {Promise<boolean>} Returns true if the index contains events for
   * the given room, false otherwise.
   */
  isRoomIndexed(roomId) {
    throw new Error("Unimplemented");
  }

  /**
   * Get statistical information of the index.
   *
   * @return {Promise<IIndexStats>} A promise that will resolve to the index
   * statistics.
   */
  async getStats() {
    throw new Error("Unimplemented");
  }

  /**
   * Get the user version of the database.
   * @return {Promise<number>} A promise that will resolve to the user stored
   * version number.
   */
  async getUserVersion() {
    throw new Error("Unimplemented");
  }

  /**
   * Set the user stored version to the given version number.
   *
   * @param {number} version The new version that should be stored in the
   * database.
   *
   * @return {Promise<void>} A promise that will resolve once the new version
   * is stored.
   */
  async setUserVersion(version) {
    throw new Error("Unimplemented");
  }

  /**
   * Commit the previously queued up events to the index.
   *
   * @return {Promise} A promise that will resolve once the queued up events
   * were added to the index.
   */
  async commitLiveEvents() {
    throw new Error("Unimplemented");
  }

  /**
   * Search the event index using the given term for matching events.
   *
   * @param {ISearchArgs} searchArgs The search configuration for the search,
   * sets the search term and determines the search result contents.
   *
   * @return {Promise<IResultRoomEvents[]>} A promise that will resolve to an array
   * of search results once the search is done.
   */
  async searchEventIndex(searchArgs) {
    throw new Error("Unimplemented");
  }

  /**
   * Add events from the room history to the event index.
   *
   * This is used to add a batch of events to the index.
   *
   * @param {[IEventAndProfile]} events The list of events and profiles that
   * should be added to the event index.
   * @param {[ICrawlerCheckpoint]} checkpoint A new crawler checkpoint that
   * should be stored in the index which should be used to continue crawling
   * the room.
   * @param {[ICrawlerCheckpoint]} oldCheckpoint The checkpoint that was used
   * to fetch the current batch of events. This checkpoint will be removed
   * from the index.
   *
   * @return {Promise} A promise that will resolve to true if all the events
   * were already added to the index, false otherwise.
   */
  async addHistoricEvents(events, checkpoint, oldCheckpoint) {
    throw new Error("Unimplemented");
  }

  /**
   * Add a new crawler checkpoint to the index.
   *
   * @param {ICrawlerCheckpoint} checkpoint The checkpoint that should be added
   * to the index.
   *
   * @return {Promise} A promise that will resolve once the checkpoint has
   * been stored.
   */
  async addCrawlerCheckpoint(checkpoint) {
    throw new Error("Unimplemented");
  }

  /**
   * Add a new crawler checkpoint to the index.
   *
   * @param {ICrawlerCheckpoint} checkpoint The checkpoint that should be
   * removed from the index.
   *
   * @return {Promise} A promise that will resolve once the checkpoint has
   * been removed.
   */
  async removeCrawlerCheckpoint(checkpoint) {
    throw new Error("Unimplemented");
  }

  /**
   * Load the stored checkpoints from the index.
   *
   * @return {Promise<[ICrawlerCheckpoint]>} A promise that will resolve to an
   * array of crawler checkpoints once they have been loaded from the index.
   */
  async loadCheckpoints() {
    throw new Error("Unimplemented");
  }

  /** Load events that contain an mxc URL to a file from the index.
   *
   * @param  {object} args Arguments object for the method.
   * @param  {string} args.roomId The ID of the room for which the events
   * should be loaded.
   * @param  {number} args.limit The maximum number of events to return.
   * @param  {string} args.fromEvent An event id of a previous event returned
   * by this method. Passing this means that we are going to continue loading
   * events from this point in the history.
   * @param  {string} args.direction The direction to which we should continue
   * loading events from. This is used only if fromEvent is used as well.
   *
   * @return {Promise<[IEventAndProfile]>} A promise that will resolve to an
   * array of Matrix events that contain mxc URLs accompanied with the
   * historic profile of the sender.
   */
  async loadFileEvents(args) {
    throw new Error("Unimplemented");
  }

  /**
   * close our event index.
   *
   * @return {Promise} A promise that will resolve once the event index has
   * been closed.
   */
  async closeEventIndex() {
    throw new Error("Unimplemented");
  }

  /**
   * Delete our current event index.
   *
   * @return {Promise} A promise that will resolve once the event index has
   * been deleted.
   */
  async deleteEventIndex() {
    throw new Error("Unimplemented");
  }
}
exports.default = BaseEventIndexManager;
//# sourceMappingURL=BaseEventIndexManager.js.map