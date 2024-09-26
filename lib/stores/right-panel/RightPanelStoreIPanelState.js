"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertCardToStore = convertCardToStore;
exports.convertToStatePanel = convertToStatePanel;
exports.convertToStorePanel = convertToStorePanel;
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

function convertToStorePanel(cacheRoom) {
  if (!cacheRoom) return undefined;
  const storeHistory = [...cacheRoom.history].map(panelState => convertCardToStore(panelState));
  return {
    isOpen: cacheRoom.isOpen,
    history: storeHistory
  };
}
function convertToStatePanel(storeRoom, room) {
  if (!storeRoom) return storeRoom;
  const stateHistory = [...storeRoom.history].map(panelStateStore => convertStoreToCard(panelStateStore, room));
  return {
    history: stateHistory,
    isOpen: storeRoom.isOpen
  };
}
function convertCardToStore(panelState) {
  const state = panelState.state ?? {};
  const stateStored = {
    widgetId: state.widgetId,
    spaceId: state.spaceId,
    isInitialEventHighlighted: state.isInitialEventHighlighted,
    initialEventScrollIntoView: state.initialEventScrollIntoView,
    threadHeadEventId: !!state?.threadHeadEvent?.getId() ? state.threadHeadEvent.getId() : undefined,
    memberInfoEventId: !!state?.memberInfoEvent?.getId() ? state.memberInfoEvent.getId() : undefined,
    initialEventId: !!state?.initialEvent?.getId() ? state.initialEvent.getId() : undefined,
    memberId: !!state?.member?.userId ? state.member.userId : undefined
  };
  return {
    state: stateStored,
    phase: panelState.phase
  };
}
function convertStoreToCard(panelStateStore, room) {
  const stateStored = panelStateStore.state ?? {};
  const state = {
    widgetId: stateStored.widgetId,
    spaceId: stateStored.spaceId,
    isInitialEventHighlighted: stateStored.isInitialEventHighlighted,
    initialEventScrollIntoView: stateStored.initialEventScrollIntoView,
    threadHeadEvent: !!stateStored?.threadHeadEventId ? room.findEventById(stateStored.threadHeadEventId) : undefined,
    memberInfoEvent: !!stateStored?.memberInfoEventId ? room.findEventById(stateStored.memberInfoEventId) : undefined,
    initialEvent: !!stateStored?.initialEventId ? room.findEventById(stateStored.initialEventId) : undefined,
    member: !!stateStored?.memberId && room.getMember(stateStored.memberId) || undefined
  };
  return {
    state: state,
    phase: panelStateStore.phase
  };
}
//# sourceMappingURL=RightPanelStoreIPanelState.js.map