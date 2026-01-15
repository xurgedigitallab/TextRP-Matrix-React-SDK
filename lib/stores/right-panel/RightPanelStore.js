"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _crypto = require("matrix-js-sdk/src/crypto");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _verification = require("../../verification");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _RightPanelStorePhases = require("./RightPanelStorePhases");
var _SettingLevel = require("../../settings/SettingLevel");
var _AsyncStore = require("../AsyncStore");
var _ReadyWatchingStore = require("../ReadyWatchingStore");
var _RightPanelStoreIPanelState = require("./RightPanelStoreIPanelState");
var _actions = require("../../dispatcher/actions");
var _SDKContext = require("../../contexts/SDKContext");
var _MatrixClientPeg = require("../../MatrixClientPeg");
/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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

/**
 * A class for tracking the state of the right panel between layouts and
 * sessions. This state includes a history for each room. Each history element
 * contains the phase (e.g. RightPanelPhase.RoomMemberInfo) and the state (e.g.
 * the member) associated with it.
 */
class RightPanelStore extends _ReadyWatchingStore.ReadyWatchingStore {
  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "global", void 0);
    (0, _defineProperty2.default)(this, "byRoom", void 0);
    (0, _defineProperty2.default)(this, "viewedRoomId", void 0);
    (0, _defineProperty2.default)(this, "onVerificationRequestUpdate", () => {
      if (!this.currentCard?.state) return;
      const {
        member
      } = this.currentCard.state;
      if (!member) return;
      const pendingRequest = (0, _verification.pendingVerificationRequestForUser)(_MatrixClientPeg.MatrixClientPeg.get(), member);
      if (pendingRequest) {
        this.currentCard.state.verificationRequest = pendingRequest;
        this.emitAndUpdateSettings();
      }
    });
    this.reset();
  }

  /**
   * Resets the store. Intended for test usage only.
   */
  reset() {
    this.global = undefined;
    this.byRoom = {};
    this.viewedRoomId = null;
  }
  async onReady() {
    this.viewedRoomId = _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
    this.matrixClient?.on(_crypto.CryptoEvent.VerificationRequest, this.onVerificationRequestUpdate);
    this.loadCacheFromSettings();
    this.emitAndUpdateSettings();
  }
  async onNotReady() {
    this.matrixClient?.off(_crypto.CryptoEvent.VerificationRequest, this.onVerificationRequestUpdate);
  }
  onDispatcherAction(payload) {
    if (payload.action !== _actions.Action.ActiveRoomChanged) return;
    const changePayload = payload;
    this.handleViewedRoomChange(changePayload.oldRoomId, changePayload.newRoomId);
  }

  // Getters
  /**
   * If you are calling this from a component that already knows about a
   * specific room from props / state, then it's best to prefer
   * `isOpenForRoom` below to ensure all your data is for a single room
   * during room changes.
   */
  get isOpen() {
    return this.byRoom[this.viewedRoomId]?.isOpen ?? false;
  }
  isOpenForRoom(roomId) {
    return this.byRoom[roomId]?.isOpen ?? false;
  }
  get roomPhaseHistory() {
    return this.byRoom[this.viewedRoomId]?.history ?? [];
  }

  /**
   * If you are calling this from a component that already knows about a
   * specific room from props / state, then it's best to prefer
   * `currentCardForRoom` below to ensure all your data is for a single room
   * during room changes.
   */
  get currentCard() {
    const hist = this.roomPhaseHistory;
    if (hist.length >= 1) {
      return hist[hist.length - 1];
    }
    return {
      state: {},
      phase: null
    };
  }
  currentCardForRoom(roomId) {
    const hist = this.byRoom[roomId]?.history ?? [];
    if (hist.length > 0) {
      return hist[hist.length - 1];
    }
    return {
      state: {},
      phase: null
    };
  }
  get previousCard() {
    const hist = this.roomPhaseHistory;
    if (hist?.length >= 2) {
      return hist[hist.length - 2];
    }
    return {
      state: {},
      phase: null
    };
  }

  // Setters
  setCard(card) {
    let allowClose = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    let roomId = arguments.length > 2 ? arguments[2] : undefined;
    const rId = roomId ?? this.viewedRoomId;
    // This function behaves as following:
    // Update state: if the same phase is send but with a state
    // Set right panel and erase history: if a "different to the current" phase is send (with or without a state)
    // If the right panel is set, this function also shows the right panel.
    const redirect = this.getVerificationRedirect(card);
    const targetPhase = redirect?.phase ?? card.phase;
    const cardState = redirect?.state ?? (Object.keys(card.state ?? {}).length === 0 ? null : card.state);

    // Checks for wrong SetRightPanelPhase requests
    if (!this.isPhaseValid(targetPhase, Boolean(rId))) return;
    if (targetPhase === this.currentCardForRoom(rId)?.phase && !!cardState) {
      // Update state: set right panel with a new state but keep the phase (don't know it this is ever needed...)
      const hist = this.byRoom[rId]?.history ?? [];
      hist[hist.length - 1].state = cardState;
      this.emitAndUpdateSettings();
    } else if (targetPhase !== this.currentCardForRoom(rId)?.phase || !this.byRoom[rId]) {
      // Set right panel and initialize/erase history
      const history = [{
        phase: targetPhase,
        state: cardState ?? {}
      }];
      this.byRoom[rId] = {
        history,
        isOpen: true
      };
      this.emitAndUpdateSettings();
    } else {
      this.show(rId);
      this.emitAndUpdateSettings();
    }
  }
  setCards(cards) {
    let allowClose = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    let roomId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    // This function sets the history of the right panel and shows the right panel if not already visible.
    const rId = roomId ?? this.viewedRoomId;
    const history = cards.map(c => ({
      phase: c.phase,
      state: c.state ?? {}
    }));
    this.byRoom[rId] = {
      history,
      isOpen: true
    };
    this.show(rId);
    this.emitAndUpdateSettings();
  }

  // Appends a card to the history and shows the right panel if not already visible
  pushCard(card) {
    let allowClose = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    let roomId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    const rId = roomId ?? this.viewedRoomId;
    const redirect = this.getVerificationRedirect(card);
    const targetPhase = redirect?.phase ?? card.phase;
    const pState = redirect?.state ?? card.state ?? {};

    // Checks for wrong SetRightPanelPhase requests
    if (!this.isPhaseValid(targetPhase, Boolean(rId))) return;
    const roomCache = this.byRoom[rId];
    if (!!roomCache) {
      // append new phase
      roomCache.history.push({
        state: pState,
        phase: targetPhase
      });
      roomCache.isOpen = allowClose ? roomCache.isOpen : true;
    } else {
      // setup room panel cache with the new card
      this.byRoom[rId] = {
        history: [{
          phase: targetPhase,
          state: pState
        }],
        // if there was no right panel store object the the panel was closed -> keep it closed, except if allowClose==false
        isOpen: !allowClose
      };
    }
    this.show(rId);
    this.emitAndUpdateSettings();
  }
  popCard() {
    let roomId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    const rId = roomId ?? this.viewedRoomId;
    if (!this.byRoom[rId]) return;
    const removedCard = this.byRoom[rId].history.pop();
    this.emitAndUpdateSettings();
    return removedCard;
  }
  togglePanel(roomId) {
    const rId = roomId ?? this.viewedRoomId;
    if (!this.byRoom[rId]) return;
    this.byRoom[rId].isOpen = !this.byRoom[rId].isOpen;
    this.emitAndUpdateSettings();
  }
  show(roomId) {
    if (!this.isOpenForRoom(roomId ?? this.viewedRoomId)) {
      this.togglePanel(roomId);
    }
  }
  hide(roomId) {
    if (this.isOpenForRoom(roomId ?? this.viewedRoomId)) {
      this.togglePanel(roomId);
    }
  }
  loadCacheFromSettings() {
    if (this.viewedRoomId) {
      const room = this.mxClient?.getRoom(this.viewedRoomId);
      if (!!room) {
        this.global = this.global ?? (0, _RightPanelStoreIPanelState.convertToStatePanel)(_SettingsStore.default.getValue("RightPanel.phasesGlobal"), room);
        this.byRoom[this.viewedRoomId] = this.byRoom[this.viewedRoomId] ?? (0, _RightPanelStoreIPanelState.convertToStatePanel)(_SettingsStore.default.getValue("RightPanel.phases", this.viewedRoomId), room);
      } else {
        _logger.logger.warn("Could not restore the right panel after load because there was no associated room object.");
      }
    }
  }
  emitAndUpdateSettings() {
    this.filterValidCards(this.global);
    const storePanelGlobal = (0, _RightPanelStoreIPanelState.convertToStorePanel)(this.global);
    _SettingsStore.default.setValue("RightPanel.phasesGlobal", null, _SettingLevel.SettingLevel.DEVICE, storePanelGlobal);
    if (!!this.viewedRoomId) {
      const panelThisRoom = this.byRoom[this.viewedRoomId];
      this.filterValidCards(panelThisRoom);
      const storePanelThisRoom = (0, _RightPanelStoreIPanelState.convertToStorePanel)(panelThisRoom);
      _SettingsStore.default.setValue("RightPanel.phases", this.viewedRoomId, _SettingLevel.SettingLevel.ROOM_DEVICE, storePanelThisRoom);
    }
    this.emit(_AsyncStore.UPDATE_EVENT, null);
  }
  filterValidCards(rightPanelForRoom) {
    if (!rightPanelForRoom?.history) return;
    rightPanelForRoom.history = rightPanelForRoom.history.filter(card => this.isCardStateValid(card));
    if (!rightPanelForRoom.history.length) {
      rightPanelForRoom.isOpen = false;
    }
  }
  isCardStateValid(card) {
    // this function does a sanity check on the card. this is required because
    // some phases require specific state properties that might not be available.
    // This can be caused on if element is reloaded and the tries to reload right panel data from id's stored in the local storage.
    // we store id's of users and matrix events. If are not yet fetched on reload the right panel cannot display them.
    // or potentially other errors.
    // (A nicer fix could be to indicate, that the right panel is loading if there is missing state data and re-emit if the data is available)
    switch (card.phase) {
      case _RightPanelStorePhases.RightPanelPhases.ThreadView:
        if (!card.state?.threadHeadEvent) {
          _logger.logger.warn("removed card from right panel because of missing threadHeadEvent in card state");
        }
        return !!card.state?.threadHeadEvent;
      case _RightPanelStorePhases.RightPanelPhases.RoomMemberInfo:
      case _RightPanelStorePhases.RightPanelPhases.SpaceMemberInfo:
      case _RightPanelStorePhases.RightPanelPhases.EncryptionPanel:
        if (!card.state?.member) {
          _logger.logger.warn("removed card from right panel because of missing member in card state");
        }
        return !!card.state?.member;
      case _RightPanelStorePhases.RightPanelPhases.Room3pidMemberInfo:
      case _RightPanelStorePhases.RightPanelPhases.Space3pidMemberInfo:
        if (!card.state?.memberInfoEvent) {
          _logger.logger.warn("removed card from right panel because of missing memberInfoEvent in card state");
        }
        return !!card.state?.memberInfoEvent;
      case _RightPanelStorePhases.RightPanelPhases.Widget:
        if (!card.state?.widgetId) {
          _logger.logger.warn("removed card from right panel because of missing widgetId in card state");
        }
        return !!card.state?.widgetId;
    }
    return true;
  }
  getVerificationRedirect(card) {
    if (card.phase === _RightPanelStorePhases.RightPanelPhases.RoomMemberInfo && card.state) {
      // RightPanelPhases.RoomMemberInfo -> needs to be changed to RightPanelPhases.EncryptionPanel if there is a pending verification request
      const {
        member
      } = card.state;
      const pendingRequest = member ? (0, _verification.pendingVerificationRequestForUser)(_MatrixClientPeg.MatrixClientPeg.get(), member) : undefined;
      if (pendingRequest) {
        return {
          phase: _RightPanelStorePhases.RightPanelPhases.EncryptionPanel,
          state: {
            verificationRequest: pendingRequest,
            member
          }
        };
      }
    }
    return null;
  }
  isPhaseValid(targetPhase, isViewingRoom) {
    if (!targetPhase || !_RightPanelStorePhases.RightPanelPhases[targetPhase]) {
      _logger.logger.warn(`Tried to switch right panel to unknown phase: ${targetPhase}`);
      return false;
    }
    if (!isViewingRoom) {
      _logger.logger.warn(`Tried to switch right panel to a room phase: ${targetPhase}, ` + `but we are currently not viewing a room`);
      return false;
    }
    return true;
  }
  handleViewedRoomChange(oldRoomId, newRoomId) {
    if (!this.mxClient) return; // not ready, onReady will handle the first room
    this.viewedRoomId = newRoomId;
    // load values from byRoomCache with the viewedRoomId.
    this.loadCacheFromSettings();

    // when we're switching to a room, clear out any stale MemberInfo cards
    // in order to fix https://github.com/vector-im/element-web/issues/21487
    if (this.currentCard?.phase !== _RightPanelStorePhases.RightPanelPhases.EncryptionPanel) {
      const panel = this.byRoom[this.viewedRoomId];
      if (panel?.history) {
        panel.history = panel.history.filter(card => card.phase != _RightPanelStorePhases.RightPanelPhases.RoomMemberInfo && card.phase != _RightPanelStorePhases.RightPanelPhases.Room3pidMemberInfo);
      }
    }
    // when we're switching to a room, clear out thread permalinks to not get you stuck in the middle of the thread
    // in order to fix https://github.com/matrix-org/matrix-react-sdk/pull/11011
    if (this.currentCard?.phase === _RightPanelStorePhases.RightPanelPhases.ThreadView) {
      this.currentCard.state.initialEvent = undefined;
      this.currentCard.state.isInitialEventHighlighted = undefined;
      this.currentCard.state.initialEventScrollIntoView = undefined;
    }

    // If the right panel stays open mode is used, and the panel was either
    // closed or never shown for that room, then force it open and display
    // the room member list.
    if (_SettingsStore.default.getValue("feature_right_panel_default_open") && !this.byRoom[this.viewedRoomId]?.isOpen) {
      const history = [{
        phase: _RightPanelStorePhases.RightPanelPhases.RoomMemberList
      }];
      const room = this.viewedRoomId ? this.mxClient?.getRoom(this.viewedRoomId) : undefined;
      if (!room?.isSpaceRoom()) {
        history.unshift({
          phase: _RightPanelStorePhases.RightPanelPhases.RoomSummary
        });
      }
      this.byRoom[this.viewedRoomId] = {
        isOpen: true,
        history
      };
    }
    this.emitAndUpdateSettings();
  }
  static get instance() {
    if (!this.internalInstance) {
      this.internalInstance = new RightPanelStore();
      this.internalInstance.start();
    }
    return this.internalInstance;
  }
}
exports.default = RightPanelStore;
(0, _defineProperty2.default)(RightPanelStore, "internalInstance", void 0);
window.mxRightPanelStore = RightPanelStore.instance;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9jcnlwdG8iLCJfZGlzcGF0Y2hlciIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfdmVyaWZpY2F0aW9uIiwiX1NldHRpbmdzU3RvcmUiLCJfUmlnaHRQYW5lbFN0b3JlUGhhc2VzIiwiX1NldHRpbmdMZXZlbCIsIl9Bc3luY1N0b3JlIiwiX1JlYWR5V2F0Y2hpbmdTdG9yZSIsIl9SaWdodFBhbmVsU3RvcmVJUGFuZWxTdGF0ZSIsIl9hY3Rpb25zIiwiX1NES0NvbnRleHQiLCJfTWF0cml4Q2xpZW50UGVnIiwiUmlnaHRQYW5lbFN0b3JlIiwiUmVhZHlXYXRjaGluZ1N0b3JlIiwiY29uc3RydWN0b3IiLCJkZWZhdWx0RGlzcGF0Y2hlciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiY3VycmVudENhcmQiLCJzdGF0ZSIsIm1lbWJlciIsInBlbmRpbmdSZXF1ZXN0IiwicGVuZGluZ1ZlcmlmaWNhdGlvblJlcXVlc3RGb3JVc2VyIiwiTWF0cml4Q2xpZW50UGVnIiwiZ2V0IiwidmVyaWZpY2F0aW9uUmVxdWVzdCIsImVtaXRBbmRVcGRhdGVTZXR0aW5ncyIsInJlc2V0IiwiZ2xvYmFsIiwidW5kZWZpbmVkIiwiYnlSb29tIiwidmlld2VkUm9vbUlkIiwib25SZWFkeSIsIlNka0NvbnRleHRDbGFzcyIsImluc3RhbmNlIiwicm9vbVZpZXdTdG9yZSIsImdldFJvb21JZCIsIm1hdHJpeENsaWVudCIsIm9uIiwiQ3J5cHRvRXZlbnQiLCJWZXJpZmljYXRpb25SZXF1ZXN0Iiwib25WZXJpZmljYXRpb25SZXF1ZXN0VXBkYXRlIiwibG9hZENhY2hlRnJvbVNldHRpbmdzIiwib25Ob3RSZWFkeSIsIm9mZiIsIm9uRGlzcGF0Y2hlckFjdGlvbiIsInBheWxvYWQiLCJhY3Rpb24iLCJBY3Rpb24iLCJBY3RpdmVSb29tQ2hhbmdlZCIsImNoYW5nZVBheWxvYWQiLCJoYW5kbGVWaWV3ZWRSb29tQ2hhbmdlIiwib2xkUm9vbUlkIiwibmV3Um9vbUlkIiwiaXNPcGVuIiwiaXNPcGVuRm9yUm9vbSIsInJvb21JZCIsInJvb21QaGFzZUhpc3RvcnkiLCJoaXN0b3J5IiwiaGlzdCIsImxlbmd0aCIsInBoYXNlIiwiY3VycmVudENhcmRGb3JSb29tIiwicHJldmlvdXNDYXJkIiwic2V0Q2FyZCIsImNhcmQiLCJhbGxvd0Nsb3NlIiwiYXJndW1lbnRzIiwicklkIiwicmVkaXJlY3QiLCJnZXRWZXJpZmljYXRpb25SZWRpcmVjdCIsInRhcmdldFBoYXNlIiwiY2FyZFN0YXRlIiwiT2JqZWN0Iiwia2V5cyIsImlzUGhhc2VWYWxpZCIsIkJvb2xlYW4iLCJzaG93Iiwic2V0Q2FyZHMiLCJjYXJkcyIsIm1hcCIsImMiLCJwdXNoQ2FyZCIsInBTdGF0ZSIsInJvb21DYWNoZSIsInB1c2giLCJwb3BDYXJkIiwicmVtb3ZlZENhcmQiLCJwb3AiLCJ0b2dnbGVQYW5lbCIsImhpZGUiLCJyb29tIiwibXhDbGllbnQiLCJnZXRSb29tIiwiY29udmVydFRvU3RhdGVQYW5lbCIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsImxvZ2dlciIsIndhcm4iLCJmaWx0ZXJWYWxpZENhcmRzIiwic3RvcmVQYW5lbEdsb2JhbCIsImNvbnZlcnRUb1N0b3JlUGFuZWwiLCJzZXRWYWx1ZSIsIlNldHRpbmdMZXZlbCIsIkRFVklDRSIsInBhbmVsVGhpc1Jvb20iLCJzdG9yZVBhbmVsVGhpc1Jvb20iLCJST09NX0RFVklDRSIsImVtaXQiLCJVUERBVEVfRVZFTlQiLCJyaWdodFBhbmVsRm9yUm9vbSIsImZpbHRlciIsImlzQ2FyZFN0YXRlVmFsaWQiLCJSaWdodFBhbmVsUGhhc2VzIiwiVGhyZWFkVmlldyIsInRocmVhZEhlYWRFdmVudCIsIlJvb21NZW1iZXJJbmZvIiwiU3BhY2VNZW1iZXJJbmZvIiwiRW5jcnlwdGlvblBhbmVsIiwiUm9vbTNwaWRNZW1iZXJJbmZvIiwiU3BhY2UzcGlkTWVtYmVySW5mbyIsIm1lbWJlckluZm9FdmVudCIsIldpZGdldCIsIndpZGdldElkIiwiaXNWaWV3aW5nUm9vbSIsInBhbmVsIiwiaW5pdGlhbEV2ZW50IiwiaXNJbml0aWFsRXZlbnRIaWdobGlnaHRlZCIsImluaXRpYWxFdmVudFNjcm9sbEludG9WaWV3IiwiUm9vbU1lbWJlckxpc3QiLCJpc1NwYWNlUm9vbSIsInVuc2hpZnQiLCJSb29tU3VtbWFyeSIsImludGVybmFsSW5zdGFuY2UiLCJzdGFydCIsImV4cG9ydHMiLCJ3aW5kb3ciLCJteFJpZ2h0UGFuZWxTdG9yZSJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zdG9yZXMvcmlnaHQtcGFuZWwvUmlnaHRQYW5lbFN0b3JlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxOS0yMDIzIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgQ3J5cHRvRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY3J5cHRvXCI7XG5pbXBvcnQgeyBPcHRpb25hbCB9IGZyb20gXCJtYXRyaXgtZXZlbnRzLXNka1wiO1xuXG5pbXBvcnQgZGVmYXVsdERpc3BhdGNoZXIgZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgcGVuZGluZ1ZlcmlmaWNhdGlvblJlcXVlc3RGb3JVc2VyIH0gZnJvbSBcIi4uLy4uL3ZlcmlmaWNhdGlvblwiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uLy4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IFJpZ2h0UGFuZWxQaGFzZXMgfSBmcm9tIFwiLi9SaWdodFBhbmVsU3RvcmVQaGFzZXNcIjtcbmltcG9ydCB7IFNldHRpbmdMZXZlbCB9IGZyb20gXCIuLi8uLi9zZXR0aW5ncy9TZXR0aW5nTGV2ZWxcIjtcbmltcG9ydCB7IFVQREFURV9FVkVOVCB9IGZyb20gXCIuLi9Bc3luY1N0b3JlXCI7XG5pbXBvcnQgeyBSZWFkeVdhdGNoaW5nU3RvcmUgfSBmcm9tIFwiLi4vUmVhZHlXYXRjaGluZ1N0b3JlXCI7XG5pbXBvcnQge1xuICAgIGNvbnZlcnRUb1N0YXRlUGFuZWwsXG4gICAgY29udmVydFRvU3RvcmVQYW5lbCxcbiAgICBJUmlnaHRQYW5lbENhcmQsXG4gICAgSVJpZ2h0UGFuZWxGb3JSb29tLFxufSBmcm9tIFwiLi9SaWdodFBhbmVsU3RvcmVJUGFuZWxTdGF0ZVwiO1xuaW1wb3J0IHsgQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi8uLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQgeyBBY3RpdmVSb29tQ2hhbmdlZFBheWxvYWQgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9wYXlsb2Fkcy9BY3RpdmVSb29tQ2hhbmdlZFBheWxvYWRcIjtcbmltcG9ydCB7IFNka0NvbnRleHRDbGFzcyB9IGZyb20gXCIuLi8uLi9jb250ZXh0cy9TREtDb250ZXh0XCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnRQZWcgfSBmcm9tIFwiLi4vLi4vTWF0cml4Q2xpZW50UGVnXCI7XG5cbi8qKlxuICogQSBjbGFzcyBmb3IgdHJhY2tpbmcgdGhlIHN0YXRlIG9mIHRoZSByaWdodCBwYW5lbCBiZXR3ZWVuIGxheW91dHMgYW5kXG4gKiBzZXNzaW9ucy4gVGhpcyBzdGF0ZSBpbmNsdWRlcyBhIGhpc3RvcnkgZm9yIGVhY2ggcm9vbS4gRWFjaCBoaXN0b3J5IGVsZW1lbnRcbiAqIGNvbnRhaW5zIHRoZSBwaGFzZSAoZS5nLiBSaWdodFBhbmVsUGhhc2UuUm9vbU1lbWJlckluZm8pIGFuZCB0aGUgc3RhdGUgKGUuZy5cbiAqIHRoZSBtZW1iZXIpIGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmlnaHRQYW5lbFN0b3JlIGV4dGVuZHMgUmVhZHlXYXRjaGluZ1N0b3JlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBpbnRlcm5hbEluc3RhbmNlOiBSaWdodFBhbmVsU3RvcmU7XG5cbiAgICBwcml2YXRlIGdsb2JhbD86IElSaWdodFBhbmVsRm9yUm9vbTtcbiAgICBwcml2YXRlIGJ5Um9vbTogeyBbcm9vbUlkOiBzdHJpbmddOiBJUmlnaHRQYW5lbEZvclJvb20gfTtcbiAgICBwcml2YXRlIHZpZXdlZFJvb21JZDogT3B0aW9uYWw8c3RyaW5nPjtcblxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHREaXNwYXRjaGVyKTtcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyB0aGUgc3RvcmUuIEludGVuZGVkIGZvciB0ZXN0IHVzYWdlIG9ubHkuXG4gICAgICovXG4gICAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLmdsb2JhbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5ieVJvb20gPSB7fTtcbiAgICAgICAgdGhpcy52aWV3ZWRSb29tSWQgPSBudWxsO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvblJlYWR5KCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRoaXMudmlld2VkUm9vbUlkID0gU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCk7XG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50Py5vbihDcnlwdG9FdmVudC5WZXJpZmljYXRpb25SZXF1ZXN0LCB0aGlzLm9uVmVyaWZpY2F0aW9uUmVxdWVzdFVwZGF0ZSk7XG4gICAgICAgIHRoaXMubG9hZENhY2hlRnJvbVNldHRpbmdzKCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uTm90UmVhZHkoKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQ/Lm9mZihDcnlwdG9FdmVudC5WZXJpZmljYXRpb25SZXF1ZXN0LCB0aGlzLm9uVmVyaWZpY2F0aW9uUmVxdWVzdFVwZGF0ZSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIG9uRGlzcGF0Y2hlckFjdGlvbihwYXlsb2FkOiBBY3Rpb25QYXlsb2FkKTogdm9pZCB7XG4gICAgICAgIGlmIChwYXlsb2FkLmFjdGlvbiAhPT0gQWN0aW9uLkFjdGl2ZVJvb21DaGFuZ2VkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2hhbmdlUGF5bG9hZCA9IDxBY3RpdmVSb29tQ2hhbmdlZFBheWxvYWQ+cGF5bG9hZDtcbiAgICAgICAgdGhpcy5oYW5kbGVWaWV3ZWRSb29tQ2hhbmdlKGNoYW5nZVBheWxvYWQub2xkUm9vbUlkLCBjaGFuZ2VQYXlsb2FkLm5ld1Jvb21JZCk7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyc1xuICAgIC8qKlxuICAgICAqIElmIHlvdSBhcmUgY2FsbGluZyB0aGlzIGZyb20gYSBjb21wb25lbnQgdGhhdCBhbHJlYWR5IGtub3dzIGFib3V0IGFcbiAgICAgKiBzcGVjaWZpYyByb29tIGZyb20gcHJvcHMgLyBzdGF0ZSwgdGhlbiBpdCdzIGJlc3QgdG8gcHJlZmVyXG4gICAgICogYGlzT3BlbkZvclJvb21gIGJlbG93IHRvIGVuc3VyZSBhbGwgeW91ciBkYXRhIGlzIGZvciBhIHNpbmdsZSByb29tXG4gICAgICogZHVyaW5nIHJvb20gY2hhbmdlcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IGlzT3BlbigpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnlSb29tW3RoaXMudmlld2VkUm9vbUlkXT8uaXNPcGVuID8/IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBpc09wZW5Gb3JSb29tKHJvb21JZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ5Um9vbVtyb29tSWRdPy5pc09wZW4gPz8gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCByb29tUGhhc2VIaXN0b3J5KCk6IEFycmF5PElSaWdodFBhbmVsQ2FyZD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ieVJvb21bdGhpcy52aWV3ZWRSb29tSWRdPy5oaXN0b3J5ID8/IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHlvdSBhcmUgY2FsbGluZyB0aGlzIGZyb20gYSBjb21wb25lbnQgdGhhdCBhbHJlYWR5IGtub3dzIGFib3V0IGFcbiAgICAgKiBzcGVjaWZpYyByb29tIGZyb20gcHJvcHMgLyBzdGF0ZSwgdGhlbiBpdCdzIGJlc3QgdG8gcHJlZmVyXG4gICAgICogYGN1cnJlbnRDYXJkRm9yUm9vbWAgYmVsb3cgdG8gZW5zdXJlIGFsbCB5b3VyIGRhdGEgaXMgZm9yIGEgc2luZ2xlIHJvb21cbiAgICAgKiBkdXJpbmcgcm9vbSBjaGFuZ2VzLlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgY3VycmVudENhcmQoKTogSVJpZ2h0UGFuZWxDYXJkIHtcbiAgICAgICAgY29uc3QgaGlzdCA9IHRoaXMucm9vbVBoYXNlSGlzdG9yeTtcbiAgICAgICAgaWYgKGhpc3QubGVuZ3RoID49IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBoaXN0W2hpc3QubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IHt9LCBwaGFzZTogbnVsbCB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBjdXJyZW50Q2FyZEZvclJvb20ocm9vbUlkOiBzdHJpbmcpOiBJUmlnaHRQYW5lbENhcmQge1xuICAgICAgICBjb25zdCBoaXN0ID0gdGhpcy5ieVJvb21bcm9vbUlkXT8uaGlzdG9yeSA/PyBbXTtcbiAgICAgICAgaWYgKGhpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGhpc3RbaGlzdC5sZW5ndGggLSAxXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdGF0ZToge30sIHBoYXNlOiBudWxsIH07XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBwcmV2aW91c0NhcmQoKTogSVJpZ2h0UGFuZWxDYXJkIHtcbiAgICAgICAgY29uc3QgaGlzdCA9IHRoaXMucm9vbVBoYXNlSGlzdG9yeTtcbiAgICAgICAgaWYgKGhpc3Q/Lmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gaGlzdFtoaXN0Lmxlbmd0aCAtIDJdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXRlOiB7fSwgcGhhc2U6IG51bGwgfTtcbiAgICB9XG5cbiAgICAvLyBTZXR0ZXJzXG4gICAgcHVibGljIHNldENhcmQoY2FyZDogSVJpZ2h0UGFuZWxDYXJkLCBhbGxvd0Nsb3NlID0gdHJ1ZSwgcm9vbUlkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHJJZCA9IHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZDtcbiAgICAgICAgLy8gVGhpcyBmdW5jdGlvbiBiZWhhdmVzIGFzIGZvbGxvd2luZzpcbiAgICAgICAgLy8gVXBkYXRlIHN0YXRlOiBpZiB0aGUgc2FtZSBwaGFzZSBpcyBzZW5kIGJ1dCB3aXRoIGEgc3RhdGVcbiAgICAgICAgLy8gU2V0IHJpZ2h0IHBhbmVsIGFuZCBlcmFzZSBoaXN0b3J5OiBpZiBhIFwiZGlmZmVyZW50IHRvIHRoZSBjdXJyZW50XCIgcGhhc2UgaXMgc2VuZCAod2l0aCBvciB3aXRob3V0IGEgc3RhdGUpXG4gICAgICAgIC8vIElmIHRoZSByaWdodCBwYW5lbCBpcyBzZXQsIHRoaXMgZnVuY3Rpb24gYWxzbyBzaG93cyB0aGUgcmlnaHQgcGFuZWwuXG4gICAgICAgIGNvbnN0IHJlZGlyZWN0ID0gdGhpcy5nZXRWZXJpZmljYXRpb25SZWRpcmVjdChjYXJkKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0UGhhc2UgPSByZWRpcmVjdD8ucGhhc2UgPz8gY2FyZC5waGFzZTtcbiAgICAgICAgY29uc3QgY2FyZFN0YXRlID0gcmVkaXJlY3Q/LnN0YXRlID8/IChPYmplY3Qua2V5cyhjYXJkLnN0YXRlID8/IHt9KS5sZW5ndGggPT09IDAgPyBudWxsIDogY2FyZC5zdGF0ZSk7XG5cbiAgICAgICAgLy8gQ2hlY2tzIGZvciB3cm9uZyBTZXRSaWdodFBhbmVsUGhhc2UgcmVxdWVzdHNcbiAgICAgICAgaWYgKCF0aGlzLmlzUGhhc2VWYWxpZCh0YXJnZXRQaGFzZSwgQm9vbGVhbihySWQpKSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0YXJnZXRQaGFzZSA9PT0gdGhpcy5jdXJyZW50Q2FyZEZvclJvb20ocklkKT8ucGhhc2UgJiYgISFjYXJkU3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBzdGF0ZTogc2V0IHJpZ2h0IHBhbmVsIHdpdGggYSBuZXcgc3RhdGUgYnV0IGtlZXAgdGhlIHBoYXNlIChkb24ndCBrbm93IGl0IHRoaXMgaXMgZXZlciBuZWVkZWQuLi4pXG4gICAgICAgICAgICBjb25zdCBoaXN0ID0gdGhpcy5ieVJvb21bcklkXT8uaGlzdG9yeSA/PyBbXTtcbiAgICAgICAgICAgIGhpc3RbaGlzdC5sZW5ndGggLSAxXS5zdGF0ZSA9IGNhcmRTdGF0ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0UGhhc2UgIT09IHRoaXMuY3VycmVudENhcmRGb3JSb29tKHJJZCk/LnBoYXNlIHx8ICF0aGlzLmJ5Um9vbVtySWRdKSB7XG4gICAgICAgICAgICAvLyBTZXQgcmlnaHQgcGFuZWwgYW5kIGluaXRpYWxpemUvZXJhc2UgaGlzdG9yeVxuICAgICAgICAgICAgY29uc3QgaGlzdG9yeSA9IFt7IHBoYXNlOiB0YXJnZXRQaGFzZSwgc3RhdGU6IGNhcmRTdGF0ZSA/PyB7fSB9XTtcbiAgICAgICAgICAgIHRoaXMuYnlSb29tW3JJZF0gPSB7IGhpc3RvcnksIGlzT3BlbjogdHJ1ZSB9O1xuICAgICAgICAgICAgdGhpcy5lbWl0QW5kVXBkYXRlU2V0dGluZ3MoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdyhySWQpO1xuICAgICAgICAgICAgdGhpcy5lbWl0QW5kVXBkYXRlU2V0dGluZ3MoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzZXRDYXJkcyhjYXJkczogSVJpZ2h0UGFuZWxDYXJkW10sIGFsbG93Q2xvc2UgPSB0cnVlLCByb29tSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsKTogdm9pZCB7XG4gICAgICAgIC8vIFRoaXMgZnVuY3Rpb24gc2V0cyB0aGUgaGlzdG9yeSBvZiB0aGUgcmlnaHQgcGFuZWwgYW5kIHNob3dzIHRoZSByaWdodCBwYW5lbCBpZiBub3QgYWxyZWFkeSB2aXNpYmxlLlxuICAgICAgICBjb25zdCBySWQgPSByb29tSWQgPz8gdGhpcy52aWV3ZWRSb29tSWQ7XG4gICAgICAgIGNvbnN0IGhpc3RvcnkgPSBjYXJkcy5tYXAoKGMpID0+ICh7IHBoYXNlOiBjLnBoYXNlLCBzdGF0ZTogYy5zdGF0ZSA/PyB7fSB9KSk7XG4gICAgICAgIHRoaXMuYnlSb29tW3JJZF0gPSB7IGhpc3RvcnksIGlzT3BlbjogdHJ1ZSB9O1xuICAgICAgICB0aGlzLnNob3cocklkKTtcbiAgICAgICAgdGhpcy5lbWl0QW5kVXBkYXRlU2V0dGluZ3MoKTtcbiAgICB9XG5cbiAgICAvLyBBcHBlbmRzIGEgY2FyZCB0byB0aGUgaGlzdG9yeSBhbmQgc2hvd3MgdGhlIHJpZ2h0IHBhbmVsIGlmIG5vdCBhbHJlYWR5IHZpc2libGVcbiAgICBwdWJsaWMgcHVzaENhcmQoY2FyZDogSVJpZ2h0UGFuZWxDYXJkLCBhbGxvd0Nsb3NlID0gdHJ1ZSwgcm9vbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuICAgICAgICBjb25zdCBySWQgPSByb29tSWQgPz8gdGhpcy52aWV3ZWRSb29tSWQ7XG4gICAgICAgIGNvbnN0IHJlZGlyZWN0ID0gdGhpcy5nZXRWZXJpZmljYXRpb25SZWRpcmVjdChjYXJkKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0UGhhc2UgPSByZWRpcmVjdD8ucGhhc2UgPz8gY2FyZC5waGFzZTtcbiAgICAgICAgY29uc3QgcFN0YXRlID0gcmVkaXJlY3Q/LnN0YXRlID8/IGNhcmQuc3RhdGUgPz8ge307XG5cbiAgICAgICAgLy8gQ2hlY2tzIGZvciB3cm9uZyBTZXRSaWdodFBhbmVsUGhhc2UgcmVxdWVzdHNcbiAgICAgICAgaWYgKCF0aGlzLmlzUGhhc2VWYWxpZCh0YXJnZXRQaGFzZSwgQm9vbGVhbihySWQpKSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHJvb21DYWNoZSA9IHRoaXMuYnlSb29tW3JJZF07XG4gICAgICAgIGlmICghIXJvb21DYWNoZSkge1xuICAgICAgICAgICAgLy8gYXBwZW5kIG5ldyBwaGFzZVxuICAgICAgICAgICAgcm9vbUNhY2hlLmhpc3RvcnkucHVzaCh7IHN0YXRlOiBwU3RhdGUsIHBoYXNlOiB0YXJnZXRQaGFzZSB9KTtcbiAgICAgICAgICAgIHJvb21DYWNoZS5pc09wZW4gPSBhbGxvd0Nsb3NlID8gcm9vbUNhY2hlLmlzT3BlbiA6IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzZXR1cCByb29tIHBhbmVsIGNhY2hlIHdpdGggdGhlIG5ldyBjYXJkXG4gICAgICAgICAgICB0aGlzLmJ5Um9vbVtySWRdID0ge1xuICAgICAgICAgICAgICAgIGhpc3Rvcnk6IFt7IHBoYXNlOiB0YXJnZXRQaGFzZSwgc3RhdGU6IHBTdGF0ZSB9XSxcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGVyZSB3YXMgbm8gcmlnaHQgcGFuZWwgc3RvcmUgb2JqZWN0IHRoZSB0aGUgcGFuZWwgd2FzIGNsb3NlZCAtPiBrZWVwIGl0IGNsb3NlZCwgZXhjZXB0IGlmIGFsbG93Q2xvc2U9PWZhbHNlXG4gICAgICAgICAgICAgICAgaXNPcGVuOiAhYWxsb3dDbG9zZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zaG93KHJJZCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHBvcENhcmQocm9vbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IElSaWdodFBhbmVsQ2FyZCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IHJJZCA9IHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZDtcbiAgICAgICAgaWYgKCF0aGlzLmJ5Um9vbVtySWRdKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgcmVtb3ZlZENhcmQgPSB0aGlzLmJ5Um9vbVtySWRdLmhpc3RvcnkucG9wKCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgICAgIHJldHVybiByZW1vdmVkQ2FyZDtcbiAgICB9XG5cbiAgICBwdWJsaWMgdG9nZ2xlUGFuZWwocm9vbUlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHJJZCA9IHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZDtcbiAgICAgICAgaWYgKCF0aGlzLmJ5Um9vbVtySWRdKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5ieVJvb21bcklkXS5pc09wZW4gPSAhdGhpcy5ieVJvb21bcklkXS5pc09wZW47XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHNob3cocm9vbUlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc09wZW5Gb3JSb29tKHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZCkpIHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGFuZWwocm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBoaWRlKHJvb21JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5pc09wZW5Gb3JSb29tKHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZCkpIHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGFuZWwocm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgbG9hZENhY2hlRnJvbVNldHRpbmdzKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy52aWV3ZWRSb29tSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm14Q2xpZW50Py5nZXRSb29tKHRoaXMudmlld2VkUm9vbUlkKTtcbiAgICAgICAgICAgIGlmICghIXJvb20pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsb2JhbCA9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2xvYmFsID8/IGNvbnZlcnRUb1N0YXRlUGFuZWwoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIlJpZ2h0UGFuZWwucGhhc2VzR2xvYmFsXCIpLCByb29tKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF0gPVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF0gPz9cbiAgICAgICAgICAgICAgICAgICAgY29udmVydFRvU3RhdGVQYW5lbChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiUmlnaHRQYW5lbC5waGFzZXNcIiwgdGhpcy52aWV3ZWRSb29tSWQpLCByb29tKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgICAgICAgICAgIFwiQ291bGQgbm90IHJlc3RvcmUgdGhlIHJpZ2h0IHBhbmVsIGFmdGVyIGxvYWQgYmVjYXVzZSB0aGVyZSB3YXMgbm8gYXNzb2NpYXRlZCByb29tIG9iamVjdC5cIixcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBlbWl0QW5kVXBkYXRlU2V0dGluZ3MoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZmlsdGVyVmFsaWRDYXJkcyh0aGlzLmdsb2JhbCk7XG4gICAgICAgIGNvbnN0IHN0b3JlUGFuZWxHbG9iYWwgPSBjb252ZXJ0VG9TdG9yZVBhbmVsKHRoaXMuZ2xvYmFsKTtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS5zZXRWYWx1ZShcIlJpZ2h0UGFuZWwucGhhc2VzR2xvYmFsXCIsIG51bGwsIFNldHRpbmdMZXZlbC5ERVZJQ0UsIHN0b3JlUGFuZWxHbG9iYWwpO1xuXG4gICAgICAgIGlmICghIXRoaXMudmlld2VkUm9vbUlkKSB7XG4gICAgICAgICAgICBjb25zdCBwYW5lbFRoaXNSb29tID0gdGhpcy5ieVJvb21bdGhpcy52aWV3ZWRSb29tSWRdO1xuICAgICAgICAgICAgdGhpcy5maWx0ZXJWYWxpZENhcmRzKHBhbmVsVGhpc1Jvb20pO1xuICAgICAgICAgICAgY29uc3Qgc3RvcmVQYW5lbFRoaXNSb29tID0gY29udmVydFRvU3RvcmVQYW5lbChwYW5lbFRoaXNSb29tKTtcbiAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgXCJSaWdodFBhbmVsLnBoYXNlc1wiLFxuICAgICAgICAgICAgICAgIHRoaXMudmlld2VkUm9vbUlkLFxuICAgICAgICAgICAgICAgIFNldHRpbmdMZXZlbC5ST09NX0RFVklDRSxcbiAgICAgICAgICAgICAgICBzdG9yZVBhbmVsVGhpc1Jvb20sXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW1pdChVUERBVEVfRVZFTlQsIG51bGwpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZmlsdGVyVmFsaWRDYXJkcyhyaWdodFBhbmVsRm9yUm9vbT86IElSaWdodFBhbmVsRm9yUm9vbSk6IHZvaWQge1xuICAgICAgICBpZiAoIXJpZ2h0UGFuZWxGb3JSb29tPy5oaXN0b3J5KSByZXR1cm47XG4gICAgICAgIHJpZ2h0UGFuZWxGb3JSb29tLmhpc3RvcnkgPSByaWdodFBhbmVsRm9yUm9vbS5oaXN0b3J5LmZpbHRlcigoY2FyZCkgPT4gdGhpcy5pc0NhcmRTdGF0ZVZhbGlkKGNhcmQpKTtcbiAgICAgICAgaWYgKCFyaWdodFBhbmVsRm9yUm9vbS5oaXN0b3J5Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmlnaHRQYW5lbEZvclJvb20uaXNPcGVuID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGlzQ2FyZFN0YXRlVmFsaWQoY2FyZDogSVJpZ2h0UGFuZWxDYXJkKTogYm9vbGVhbiB7XG4gICAgICAgIC8vIHRoaXMgZnVuY3Rpb24gZG9lcyBhIHNhbml0eSBjaGVjayBvbiB0aGUgY2FyZC4gdGhpcyBpcyByZXF1aXJlZCBiZWNhdXNlXG4gICAgICAgIC8vIHNvbWUgcGhhc2VzIHJlcXVpcmUgc3BlY2lmaWMgc3RhdGUgcHJvcGVydGllcyB0aGF0IG1pZ2h0IG5vdCBiZSBhdmFpbGFibGUuXG4gICAgICAgIC8vIFRoaXMgY2FuIGJlIGNhdXNlZCBvbiBpZiBlbGVtZW50IGlzIHJlbG9hZGVkIGFuZCB0aGUgdHJpZXMgdG8gcmVsb2FkIHJpZ2h0IHBhbmVsIGRhdGEgZnJvbSBpZCdzIHN0b3JlZCBpbiB0aGUgbG9jYWwgc3RvcmFnZS5cbiAgICAgICAgLy8gd2Ugc3RvcmUgaWQncyBvZiB1c2VycyBhbmQgbWF0cml4IGV2ZW50cy4gSWYgYXJlIG5vdCB5ZXQgZmV0Y2hlZCBvbiByZWxvYWQgdGhlIHJpZ2h0IHBhbmVsIGNhbm5vdCBkaXNwbGF5IHRoZW0uXG4gICAgICAgIC8vIG9yIHBvdGVudGlhbGx5IG90aGVyIGVycm9ycy5cbiAgICAgICAgLy8gKEEgbmljZXIgZml4IGNvdWxkIGJlIHRvIGluZGljYXRlLCB0aGF0IHRoZSByaWdodCBwYW5lbCBpcyBsb2FkaW5nIGlmIHRoZXJlIGlzIG1pc3Npbmcgc3RhdGUgZGF0YSBhbmQgcmUtZW1pdCBpZiB0aGUgZGF0YSBpcyBhdmFpbGFibGUpXG4gICAgICAgIHN3aXRjaCAoY2FyZC5waGFzZSkge1xuICAgICAgICAgICAgY2FzZSBSaWdodFBhbmVsUGhhc2VzLlRocmVhZFZpZXc6XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy50aHJlYWRIZWFkRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJyZW1vdmVkIGNhcmQgZnJvbSByaWdodCBwYW5lbCBiZWNhdXNlIG9mIG1pc3NpbmcgdGhyZWFkSGVhZEV2ZW50IGluIGNhcmQgc3RhdGVcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhIWNhcmQuc3RhdGU/LnRocmVhZEhlYWRFdmVudDtcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5Sb29tTWVtYmVySW5mbzpcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5TcGFjZU1lbWJlckluZm86XG4gICAgICAgICAgICBjYXNlIFJpZ2h0UGFuZWxQaGFzZXMuRW5jcnlwdGlvblBhbmVsOlxuICAgICAgICAgICAgICAgIGlmICghY2FyZC5zdGF0ZT8ubWVtYmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKFwicmVtb3ZlZCBjYXJkIGZyb20gcmlnaHQgcGFuZWwgYmVjYXVzZSBvZiBtaXNzaW5nIG1lbWJlciBpbiBjYXJkIHN0YXRlXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gISFjYXJkLnN0YXRlPy5tZW1iZXI7XG4gICAgICAgICAgICBjYXNlIFJpZ2h0UGFuZWxQaGFzZXMuUm9vbTNwaWRNZW1iZXJJbmZvOlxuICAgICAgICAgICAgY2FzZSBSaWdodFBhbmVsUGhhc2VzLlNwYWNlM3BpZE1lbWJlckluZm86XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy5tZW1iZXJJbmZvRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJyZW1vdmVkIGNhcmQgZnJvbSByaWdodCBwYW5lbCBiZWNhdXNlIG9mIG1pc3NpbmcgbWVtYmVySW5mb0V2ZW50IGluIGNhcmQgc3RhdGVcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhIWNhcmQuc3RhdGU/Lm1lbWJlckluZm9FdmVudDtcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5XaWRnZXQ6XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy53aWRnZXRJZCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybihcInJlbW92ZWQgY2FyZCBmcm9tIHJpZ2h0IHBhbmVsIGJlY2F1c2Ugb2YgbWlzc2luZyB3aWRnZXRJZCBpbiBjYXJkIHN0YXRlXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gISFjYXJkLnN0YXRlPy53aWRnZXRJZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFZlcmlmaWNhdGlvblJlZGlyZWN0KGNhcmQ6IElSaWdodFBhbmVsQ2FyZCk6IElSaWdodFBhbmVsQ2FyZCB8IG51bGwge1xuICAgICAgICBpZiAoY2FyZC5waGFzZSA9PT0gUmlnaHRQYW5lbFBoYXNlcy5Sb29tTWVtYmVySW5mbyAmJiBjYXJkLnN0YXRlKSB7XG4gICAgICAgICAgICAvLyBSaWdodFBhbmVsUGhhc2VzLlJvb21NZW1iZXJJbmZvIC0+IG5lZWRzIHRvIGJlIGNoYW5nZWQgdG8gUmlnaHRQYW5lbFBoYXNlcy5FbmNyeXB0aW9uUGFuZWwgaWYgdGhlcmUgaXMgYSBwZW5kaW5nIHZlcmlmaWNhdGlvbiByZXF1ZXN0XG4gICAgICAgICAgICBjb25zdCB7IG1lbWJlciB9ID0gY2FyZC5zdGF0ZTtcbiAgICAgICAgICAgIGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gbWVtYmVyXG4gICAgICAgICAgICAgICAgPyBwZW5kaW5nVmVyaWZpY2F0aW9uUmVxdWVzdEZvclVzZXIoTWF0cml4Q2xpZW50UGVnLmdldCgpLCBtZW1iZXIpXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAocGVuZGluZ1JlcXVlc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBwaGFzZTogUmlnaHRQYW5lbFBoYXNlcy5FbmNyeXB0aW9uUGFuZWwsXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25SZXF1ZXN0OiBwZW5kaW5nUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbWJlcixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNQaGFzZVZhbGlkKHRhcmdldFBoYXNlOiBSaWdodFBhbmVsUGhhc2VzIHwgbnVsbCwgaXNWaWV3aW5nUm9vbTogYm9vbGVhbik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRhcmdldFBoYXNlIHx8ICFSaWdodFBhbmVsUGhhc2VzW3RhcmdldFBoYXNlXSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYFRyaWVkIHRvIHN3aXRjaCByaWdodCBwYW5lbCB0byB1bmtub3duIHBoYXNlOiAke3RhcmdldFBoYXNlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNWaWV3aW5nUm9vbSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgICAgICAgYFRyaWVkIHRvIHN3aXRjaCByaWdodCBwYW5lbCB0byBhIHJvb20gcGhhc2U6ICR7dGFyZ2V0UGhhc2V9LCBgICtcbiAgICAgICAgICAgICAgICAgICAgYGJ1dCB3ZSBhcmUgY3VycmVudGx5IG5vdCB2aWV3aW5nIGEgcm9vbWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25WZXJpZmljYXRpb25SZXF1ZXN0VXBkYXRlID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuY3VycmVudENhcmQ/LnN0YXRlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHsgbWVtYmVyIH0gPSB0aGlzLmN1cnJlbnRDYXJkLnN0YXRlO1xuICAgICAgICBpZiAoIW1lbWJlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBwZW5kaW5nUmVxdWVzdCA9IHBlbmRpbmdWZXJpZmljYXRpb25SZXF1ZXN0Rm9yVXNlcihNYXRyaXhDbGllbnRQZWcuZ2V0KCksIG1lbWJlcik7XG4gICAgICAgIGlmIChwZW5kaW5nUmVxdWVzdCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS52ZXJpZmljYXRpb25SZXF1ZXN0ID0gcGVuZGluZ1JlcXVlc3Q7XG4gICAgICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgaGFuZGxlVmlld2VkUm9vbUNoYW5nZShvbGRSb29tSWQ6IE9wdGlvbmFsPHN0cmluZz4sIG5ld1Jvb21JZDogT3B0aW9uYWw8c3RyaW5nPik6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMubXhDbGllbnQpIHJldHVybjsgLy8gbm90IHJlYWR5LCBvblJlYWR5IHdpbGwgaGFuZGxlIHRoZSBmaXJzdCByb29tXG4gICAgICAgIHRoaXMudmlld2VkUm9vbUlkID0gbmV3Um9vbUlkO1xuICAgICAgICAvLyBsb2FkIHZhbHVlcyBmcm9tIGJ5Um9vbUNhY2hlIHdpdGggdGhlIHZpZXdlZFJvb21JZC5cbiAgICAgICAgdGhpcy5sb2FkQ2FjaGVGcm9tU2V0dGluZ3MoKTtcblxuICAgICAgICAvLyB3aGVuIHdlJ3JlIHN3aXRjaGluZyB0byBhIHJvb20sIGNsZWFyIG91dCBhbnkgc3RhbGUgTWVtYmVySW5mbyBjYXJkc1xuICAgICAgICAvLyBpbiBvcmRlciB0byBmaXggaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMjE0ODdcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQ/LnBoYXNlICE9PSBSaWdodFBhbmVsUGhhc2VzLkVuY3J5cHRpb25QYW5lbCkge1xuICAgICAgICAgICAgY29uc3QgcGFuZWwgPSB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF07XG4gICAgICAgICAgICBpZiAocGFuZWw/Lmhpc3RvcnkpIHtcbiAgICAgICAgICAgICAgICBwYW5lbC5oaXN0b3J5ID0gcGFuZWwuaGlzdG9yeS5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgIChjYXJkKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZC5waGFzZSAhPSBSaWdodFBhbmVsUGhhc2VzLlJvb21NZW1iZXJJbmZvICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkLnBoYXNlICE9IFJpZ2h0UGFuZWxQaGFzZXMuUm9vbTNwaWRNZW1iZXJJbmZvLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gd2hlbiB3ZSdyZSBzd2l0Y2hpbmcgdG8gYSByb29tLCBjbGVhciBvdXQgdGhyZWFkIHBlcm1hbGlua3MgdG8gbm90IGdldCB5b3Ugc3R1Y2sgaW4gdGhlIG1pZGRsZSBvZiB0aGUgdGhyZWFkXG4gICAgICAgIC8vIGluIG9yZGVyIHRvIGZpeCBodHRwczovL2dpdGh1Yi5jb20vbWF0cml4LW9yZy9tYXRyaXgtcmVhY3Qtc2RrL3B1bGwvMTEwMTFcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQ/LnBoYXNlID09PSBSaWdodFBhbmVsUGhhc2VzLlRocmVhZFZpZXcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuc3RhdGUuaW5pdGlhbEV2ZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS5pc0luaXRpYWxFdmVudEhpZ2hsaWdodGVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS5pbml0aWFsRXZlbnRTY3JvbGxJbnRvVmlldyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoZSByaWdodCBwYW5lbCBzdGF5cyBvcGVuIG1vZGUgaXMgdXNlZCwgYW5kIHRoZSBwYW5lbCB3YXMgZWl0aGVyXG4gICAgICAgIC8vIGNsb3NlZCBvciBuZXZlciBzaG93biBmb3IgdGhhdCByb29tLCB0aGVuIGZvcmNlIGl0IG9wZW4gYW5kIGRpc3BsYXlcbiAgICAgICAgLy8gdGhlIHJvb20gbWVtYmVyIGxpc3QuXG4gICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9yaWdodF9wYW5lbF9kZWZhdWx0X29wZW5cIikgJiYgIXRoaXMuYnlSb29tW3RoaXMudmlld2VkUm9vbUlkXT8uaXNPcGVuKSB7XG4gICAgICAgICAgICBjb25zdCBoaXN0b3J5ID0gW3sgcGhhc2U6IFJpZ2h0UGFuZWxQaGFzZXMuUm9vbU1lbWJlckxpc3QgfV07XG4gICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy52aWV3ZWRSb29tSWQgPyB0aGlzLm14Q2xpZW50Py5nZXRSb29tKHRoaXMudmlld2VkUm9vbUlkKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICghcm9vbT8uaXNTcGFjZVJvb20oKSkge1xuICAgICAgICAgICAgICAgIGhpc3RvcnkudW5zaGlmdCh7IHBoYXNlOiBSaWdodFBhbmVsUGhhc2VzLlJvb21TdW1tYXJ5IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ieVJvb21bdGhpcy52aWV3ZWRSb29tSWRdID0ge1xuICAgICAgICAgICAgICAgIGlzT3BlbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBoaXN0b3J5LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0IGluc3RhbmNlKCk6IFJpZ2h0UGFuZWxTdG9yZSB7XG4gICAgICAgIGlmICghdGhpcy5pbnRlcm5hbEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsSW5zdGFuY2UgPSBuZXcgUmlnaHRQYW5lbFN0b3JlKCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsSW5zdGFuY2Uuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcm5hbEluc3RhbmNlO1xuICAgIH1cbn1cblxud2luZG93Lm14UmlnaHRQYW5lbFN0b3JlID0gUmlnaHRQYW5lbFN0b3JlLmluc3RhbmNlO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWdCQSxJQUFBQSxPQUFBLEdB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