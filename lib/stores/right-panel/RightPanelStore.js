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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9jcnlwdG8iLCJfZGlzcGF0Y2hlciIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfdmVyaWZpY2F0aW9uIiwiX1NldHRpbmdzU3RvcmUiLCJfUmlnaHRQYW5lbFN0b3JlUGhhc2VzIiwiX1NldHRpbmdMZXZlbCIsIl9Bc3luY1N0b3JlIiwiX1JlYWR5V2F0Y2hpbmdTdG9yZSIsIl9SaWdodFBhbmVsU3RvcmVJUGFuZWxTdGF0ZSIsIl9hY3Rpb25zIiwiX1NES0NvbnRleHQiLCJfTWF0cml4Q2xpZW50UGVnIiwiUmlnaHRQYW5lbFN0b3JlIiwiUmVhZHlXYXRjaGluZ1N0b3JlIiwiY29uc3RydWN0b3IiLCJkZWZhdWx0RGlzcGF0Y2hlciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiY3VycmVudENhcmQiLCJzdGF0ZSIsIm1lbWJlciIsInBlbmRpbmdSZXF1ZXN0IiwicGVuZGluZ1ZlcmlmaWNhdGlvblJlcXVlc3RGb3JVc2VyIiwiTWF0cml4Q2xpZW50UGVnIiwiZ2V0IiwidmVyaWZpY2F0aW9uUmVxdWVzdCIsImVtaXRBbmRVcGRhdGVTZXR0aW5ncyIsInJlc2V0IiwiZ2xvYmFsIiwidW5kZWZpbmVkIiwiYnlSb29tIiwidmlld2VkUm9vbUlkIiwib25SZWFkeSIsIlNka0NvbnRleHRDbGFzcyIsImluc3RhbmNlIiwicm9vbVZpZXdTdG9yZSIsImdldFJvb21JZCIsIm1hdHJpeENsaWVudCIsIm9uIiwiQ3J5cHRvRXZlbnQiLCJWZXJpZmljYXRpb25SZXF1ZXN0Iiwib25WZXJpZmljYXRpb25SZXF1ZXN0VXBkYXRlIiwibG9hZENhY2hlRnJvbVNldHRpbmdzIiwib25Ob3RSZWFkeSIsIm9mZiIsIm9uRGlzcGF0Y2hlckFjdGlvbiIsInBheWxvYWQiLCJhY3Rpb24iLCJBY3Rpb24iLCJBY3RpdmVSb29tQ2hhbmdlZCIsImNoYW5nZVBheWxvYWQiLCJoYW5kbGVWaWV3ZWRSb29tQ2hhbmdlIiwib2xkUm9vbUlkIiwibmV3Um9vbUlkIiwiaXNPcGVuIiwiaXNPcGVuRm9yUm9vbSIsInJvb21JZCIsInJvb21QaGFzZUhpc3RvcnkiLCJoaXN0b3J5IiwiaGlzdCIsImxlbmd0aCIsInBoYXNlIiwiY3VycmVudENhcmRGb3JSb29tIiwicHJldmlvdXNDYXJkIiwic2V0Q2FyZCIsImNhcmQiLCJhbGxvd0Nsb3NlIiwiYXJndW1lbnRzIiwicklkIiwicmVkaXJlY3QiLCJnZXRWZXJpZmljYXRpb25SZWRpcmVjdCIsInRhcmdldFBoYXNlIiwiY2FyZFN0YXRlIiwiT2JqZWN0Iiwia2V5cyIsImlzUGhhc2VWYWxpZCIsIkJvb2xlYW4iLCJzaG93Iiwic2V0Q2FyZHMiLCJjYXJkcyIsIm1hcCIsImMiLCJwdXNoQ2FyZCIsImNvbnNvbGUiLCJsb2ciLCJwU3RhdGUiLCJyb29tQ2FjaGUiLCJwdXNoIiwicG9wQ2FyZCIsInJlbW92ZWRDYXJkIiwicG9wIiwidG9nZ2xlUGFuZWwiLCJoaWRlIiwicm9vbSIsIm14Q2xpZW50IiwiZ2V0Um9vbSIsImNvbnZlcnRUb1N0YXRlUGFuZWwiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJsb2dnZXIiLCJ3YXJuIiwiZmlsdGVyVmFsaWRDYXJkcyIsInN0b3JlUGFuZWxHbG9iYWwiLCJjb252ZXJ0VG9TdG9yZVBhbmVsIiwic2V0VmFsdWUiLCJTZXR0aW5nTGV2ZWwiLCJERVZJQ0UiLCJwYW5lbFRoaXNSb29tIiwic3RvcmVQYW5lbFRoaXNSb29tIiwiUk9PTV9ERVZJQ0UiLCJlbWl0IiwiVVBEQVRFX0VWRU5UIiwicmlnaHRQYW5lbEZvclJvb20iLCJmaWx0ZXIiLCJpc0NhcmRTdGF0ZVZhbGlkIiwiUmlnaHRQYW5lbFBoYXNlcyIsIlRocmVhZFZpZXciLCJ0aHJlYWRIZWFkRXZlbnQiLCJSb29tTWVtYmVySW5mbyIsIlNwYWNlTWVtYmVySW5mbyIsIkVuY3J5cHRpb25QYW5lbCIsIlJvb20zcGlkTWVtYmVySW5mbyIsIlNwYWNlM3BpZE1lbWJlckluZm8iLCJtZW1iZXJJbmZvRXZlbnQiLCJXaWRnZXQiLCJ3aWRnZXRJZCIsImlzVmlld2luZ1Jvb20iLCJwYW5lbCIsImluaXRpYWxFdmVudCIsImlzSW5pdGlhbEV2ZW50SGlnaGxpZ2h0ZWQiLCJpbml0aWFsRXZlbnRTY3JvbGxJbnRvVmlldyIsIlJvb21NZW1iZXJMaXN0IiwiaXNTcGFjZVJvb20iLCJ1bnNoaWZ0IiwiUm9vbVN1bW1hcnkiLCJpbnRlcm5hbEluc3RhbmNlIiwic3RhcnQiLCJleHBvcnRzIiwid2luZG93IiwibXhSaWdodFBhbmVsU3RvcmUiXSwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc3RvcmVzL3JpZ2h0LXBhbmVsL1JpZ2h0UGFuZWxTdG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTktMjAyMyBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IENyeXB0b0V2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NyeXB0b1wiO1xuaW1wb3J0IHsgT3B0aW9uYWwgfSBmcm9tIFwibWF0cml4LWV2ZW50cy1zZGtcIjtcblxuaW1wb3J0IGRlZmF1bHREaXNwYXRjaGVyIGZyb20gXCIuLi8uLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IHBlbmRpbmdWZXJpZmljYXRpb25SZXF1ZXN0Rm9yVXNlciB9IGZyb20gXCIuLi8uLi92ZXJpZmljYXRpb25cIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuLi8uLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgeyBSaWdodFBhbmVsUGhhc2VzIH0gZnJvbSBcIi4vUmlnaHRQYW5lbFN0b3JlUGhhc2VzXCI7XG5pbXBvcnQgeyBTZXR0aW5nTGV2ZWwgfSBmcm9tIFwiLi4vLi4vc2V0dGluZ3MvU2V0dGluZ0xldmVsXCI7XG5pbXBvcnQgeyBVUERBVEVfRVZFTlQgfSBmcm9tIFwiLi4vQXN5bmNTdG9yZVwiO1xuaW1wb3J0IHsgUmVhZHlXYXRjaGluZ1N0b3JlIH0gZnJvbSBcIi4uL1JlYWR5V2F0Y2hpbmdTdG9yZVwiO1xuaW1wb3J0IHtcbiAgICBjb252ZXJ0VG9TdGF0ZVBhbmVsLFxuICAgIGNvbnZlcnRUb1N0b3JlUGFuZWwsXG4gICAgSVJpZ2h0UGFuZWxDYXJkLFxuICAgIElSaWdodFBhbmVsRm9yUm9vbSxcbn0gZnJvbSBcIi4vUmlnaHRQYW5lbFN0b3JlSVBhbmVsU3RhdGVcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9wYXlsb2Fkc1wiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvYWN0aW9uc1wiO1xuaW1wb3J0IHsgQWN0aXZlUm9vbUNoYW5nZWRQYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvQWN0aXZlUm9vbUNoYW5nZWRQYXlsb2FkXCI7XG5pbXBvcnQgeyBTZGtDb250ZXh0Q2xhc3MgfSBmcm9tIFwiLi4vLi4vY29udGV4dHMvU0RLQ29udGV4dFwiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50UGVnIH0gZnJvbSBcIi4uLy4uL01hdHJpeENsaWVudFBlZ1wiO1xuXG4vKipcbiAqIEEgY2xhc3MgZm9yIHRyYWNraW5nIHRoZSBzdGF0ZSBvZiB0aGUgcmlnaHQgcGFuZWwgYmV0d2VlbiBsYXlvdXRzIGFuZFxuICogc2Vzc2lvbnMuIFRoaXMgc3RhdGUgaW5jbHVkZXMgYSBoaXN0b3J5IGZvciBlYWNoIHJvb20uIEVhY2ggaGlzdG9yeSBlbGVtZW50XG4gKiBjb250YWlucyB0aGUgcGhhc2UgKGUuZy4gUmlnaHRQYW5lbFBoYXNlLlJvb21NZW1iZXJJbmZvKSBhbmQgdGhlIHN0YXRlIChlLmcuXG4gKiB0aGUgbWVtYmVyKSBhc3NvY2lhdGVkIHdpdGggaXQuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJpZ2h0UGFuZWxTdG9yZSBleHRlbmRzIFJlYWR5V2F0Y2hpbmdTdG9yZSB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgaW50ZXJuYWxJbnN0YW5jZTogUmlnaHRQYW5lbFN0b3JlO1xuXG4gICAgcHJpdmF0ZSBnbG9iYWw/OiBJUmlnaHRQYW5lbEZvclJvb207XG4gICAgcHJpdmF0ZSBieVJvb206IHsgW3Jvb21JZDogc3RyaW5nXTogSVJpZ2h0UGFuZWxGb3JSb29tIH07XG4gICAgcHJpdmF0ZSB2aWV3ZWRSb29tSWQ6IE9wdGlvbmFsPHN0cmluZz47XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihkZWZhdWx0RGlzcGF0Y2hlcik7XG4gICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldHMgdGhlIHN0b3JlLiBJbnRlbmRlZCBmb3IgdGVzdCB1c2FnZSBvbmx5LlxuICAgICAqL1xuICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5nbG9iYWwgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuYnlSb29tID0ge307XG4gICAgICAgIHRoaXMudmlld2VkUm9vbUlkID0gbnVsbDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYXN5bmMgb25SZWFkeSgpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0aGlzLnZpZXdlZFJvb21JZCA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpO1xuICAgICAgICB0aGlzLm1hdHJpeENsaWVudD8ub24oQ3J5cHRvRXZlbnQuVmVyaWZpY2F0aW9uUmVxdWVzdCwgdGhpcy5vblZlcmlmaWNhdGlvblJlcXVlc3RVcGRhdGUpO1xuICAgICAgICB0aGlzLmxvYWRDYWNoZUZyb21TZXR0aW5ncygpO1xuICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvbk5vdFJlYWR5KCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50Py5vZmYoQ3J5cHRvRXZlbnQuVmVyaWZpY2F0aW9uUmVxdWVzdCwgdGhpcy5vblZlcmlmaWNhdGlvblJlcXVlc3RVcGRhdGUpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBvbkRpc3BhdGNoZXJBY3Rpb24ocGF5bG9hZDogQWN0aW9uUGF5bG9hZCk6IHZvaWQge1xuICAgICAgICBpZiAocGF5bG9hZC5hY3Rpb24gIT09IEFjdGlvbi5BY3RpdmVSb29tQ2hhbmdlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGNoYW5nZVBheWxvYWQgPSA8QWN0aXZlUm9vbUNoYW5nZWRQYXlsb2FkPnBheWxvYWQ7XG4gICAgICAgIHRoaXMuaGFuZGxlVmlld2VkUm9vbUNoYW5nZShjaGFuZ2VQYXlsb2FkLm9sZFJvb21JZCwgY2hhbmdlUGF5bG9hZC5uZXdSb29tSWQpO1xuICAgIH1cblxuICAgIC8vIEdldHRlcnNcbiAgICAvKipcbiAgICAgKiBJZiB5b3UgYXJlIGNhbGxpbmcgdGhpcyBmcm9tIGEgY29tcG9uZW50IHRoYXQgYWxyZWFkeSBrbm93cyBhYm91dCBhXG4gICAgICogc3BlY2lmaWMgcm9vbSBmcm9tIHByb3BzIC8gc3RhdGUsIHRoZW4gaXQncyBiZXN0IHRvIHByZWZlclxuICAgICAqIGBpc09wZW5Gb3JSb29tYCBiZWxvdyB0byBlbnN1cmUgYWxsIHlvdXIgZGF0YSBpcyBmb3IgYSBzaW5nbGUgcm9vbVxuICAgICAqIGR1cmluZyByb29tIGNoYW5nZXMuXG4gICAgICovXG4gICAgcHVibGljIGdldCBpc09wZW4oKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF0/LmlzT3BlbiA/PyBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgaXNPcGVuRm9yUm9vbShyb29tSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ieVJvb21bcm9vbUlkXT8uaXNPcGVuID8/IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgcm9vbVBoYXNlSGlzdG9yeSgpOiBBcnJheTxJUmlnaHRQYW5lbENhcmQ+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnlSb29tW3RoaXMudmlld2VkUm9vbUlkXT8uaGlzdG9yeSA/PyBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB5b3UgYXJlIGNhbGxpbmcgdGhpcyBmcm9tIGEgY29tcG9uZW50IHRoYXQgYWxyZWFkeSBrbm93cyBhYm91dCBhXG4gICAgICogc3BlY2lmaWMgcm9vbSBmcm9tIHByb3BzIC8gc3RhdGUsIHRoZW4gaXQncyBiZXN0IHRvIHByZWZlclxuICAgICAqIGBjdXJyZW50Q2FyZEZvclJvb21gIGJlbG93IHRvIGVuc3VyZSBhbGwgeW91ciBkYXRhIGlzIGZvciBhIHNpbmdsZSByb29tXG4gICAgICogZHVyaW5nIHJvb20gY2hhbmdlcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IGN1cnJlbnRDYXJkKCk6IElSaWdodFBhbmVsQ2FyZCB7XG4gICAgICAgIGNvbnN0IGhpc3QgPSB0aGlzLnJvb21QaGFzZUhpc3Rvcnk7XG4gICAgICAgIGlmIChoaXN0Lmxlbmd0aCA+PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXRlOiB7fSwgcGhhc2U6IG51bGwgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgY3VycmVudENhcmRGb3JSb29tKHJvb21JZDogc3RyaW5nKTogSVJpZ2h0UGFuZWxDYXJkIHtcbiAgICAgICAgY29uc3QgaGlzdCA9IHRoaXMuYnlSb29tW3Jvb21JZF0/Lmhpc3RvcnkgPz8gW107XG4gICAgICAgIGlmIChoaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBoaXN0W2hpc3QubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IHt9LCBwaGFzZTogbnVsbCB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgcHJldmlvdXNDYXJkKCk6IElSaWdodFBhbmVsQ2FyZCB7XG4gICAgICAgIGNvbnN0IGhpc3QgPSB0aGlzLnJvb21QaGFzZUhpc3Rvcnk7XG4gICAgICAgIGlmIChoaXN0Py5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgcmV0dXJuIGhpc3RbaGlzdC5sZW5ndGggLSAyXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdGF0ZToge30sIHBoYXNlOiBudWxsIH07XG4gICAgfVxuXG4gICAgLy8gU2V0dGVyc1xuICAgIHB1YmxpYyBzZXRDYXJkKGNhcmQ6IElSaWdodFBhbmVsQ2FyZCwgYWxsb3dDbG9zZSA9IHRydWUsIHJvb21JZD86IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBySWQgPSByb29tSWQgPz8gdGhpcy52aWV3ZWRSb29tSWQ7XG4gICAgICAgIC8vIFRoaXMgZnVuY3Rpb24gYmVoYXZlcyBhcyBmb2xsb3dpbmc6XG4gICAgICAgIC8vIFVwZGF0ZSBzdGF0ZTogaWYgdGhlIHNhbWUgcGhhc2UgaXMgc2VuZCBidXQgd2l0aCBhIHN0YXRlXG4gICAgICAgIC8vIFNldCByaWdodCBwYW5lbCBhbmQgZXJhc2UgaGlzdG9yeTogaWYgYSBcImRpZmZlcmVudCB0byB0aGUgY3VycmVudFwiIHBoYXNlIGlzIHNlbmQgKHdpdGggb3Igd2l0aG91dCBhIHN0YXRlKVxuICAgICAgICAvLyBJZiB0aGUgcmlnaHQgcGFuZWwgaXMgc2V0LCB0aGlzIGZ1bmN0aW9uIGFsc28gc2hvd3MgdGhlIHJpZ2h0IHBhbmVsLlxuICAgICAgICBjb25zdCByZWRpcmVjdCA9IHRoaXMuZ2V0VmVyaWZpY2F0aW9uUmVkaXJlY3QoY2FyZCk7XG4gICAgICAgIGNvbnN0IHRhcmdldFBoYXNlID0gcmVkaXJlY3Q/LnBoYXNlID8/IGNhcmQucGhhc2U7XG4gICAgICAgIGNvbnN0IGNhcmRTdGF0ZSA9IHJlZGlyZWN0Py5zdGF0ZSA/PyAoT2JqZWN0LmtleXMoY2FyZC5zdGF0ZSA/PyB7fSkubGVuZ3RoID09PSAwID8gbnVsbCA6IGNhcmQuc3RhdGUpO1xuXG4gICAgICAgIC8vIENoZWNrcyBmb3Igd3JvbmcgU2V0UmlnaHRQYW5lbFBoYXNlIHJlcXVlc3RzXG4gICAgICAgIGlmICghdGhpcy5pc1BoYXNlVmFsaWQodGFyZ2V0UGhhc2UsIEJvb2xlYW4ocklkKSkpIHJldHVybjtcblxuICAgICAgICBpZiAodGFyZ2V0UGhhc2UgPT09IHRoaXMuY3VycmVudENhcmRGb3JSb29tKHJJZCk/LnBoYXNlICYmICEhY2FyZFN0YXRlKSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgc3RhdGU6IHNldCByaWdodCBwYW5lbCB3aXRoIGEgbmV3IHN0YXRlIGJ1dCBrZWVwIHRoZSBwaGFzZSAoZG9uJ3Qga25vdyBpdCB0aGlzIGlzIGV2ZXIgbmVlZGVkLi4uKVxuICAgICAgICAgICAgY29uc3QgaGlzdCA9IHRoaXMuYnlSb29tW3JJZF0/Lmhpc3RvcnkgPz8gW107XG4gICAgICAgICAgICBoaXN0W2hpc3QubGVuZ3RoIC0gMV0uc3RhdGUgPSBjYXJkU3RhdGU7XG4gICAgICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldFBoYXNlICE9PSB0aGlzLmN1cnJlbnRDYXJkRm9yUm9vbShySWQpPy5waGFzZSB8fCAhdGhpcy5ieVJvb21bcklkXSkge1xuICAgICAgICAgICAgLy8gU2V0IHJpZ2h0IHBhbmVsIGFuZCBpbml0aWFsaXplL2VyYXNlIGhpc3RvcnlcbiAgICAgICAgICAgIGNvbnN0IGhpc3RvcnkgPSBbeyBwaGFzZTogdGFyZ2V0UGhhc2UsIHN0YXRlOiBjYXJkU3RhdGUgPz8ge30gfV07XG4gICAgICAgICAgICB0aGlzLmJ5Um9vbVtySWRdID0geyBoaXN0b3J5LCBpc09wZW46IHRydWUgfTtcbiAgICAgICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNob3cocklkKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0Q2FyZHMoY2FyZHM6IElSaWdodFBhbmVsQ2FyZFtdLCBhbGxvd0Nsb3NlID0gdHJ1ZSwgcm9vbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuICAgICAgICAvLyBUaGlzIGZ1bmN0aW9uIHNldHMgdGhlIGhpc3Rvcnkgb2YgdGhlIHJpZ2h0IHBhbmVsIGFuZCBzaG93cyB0aGUgcmlnaHQgcGFuZWwgaWYgbm90IGFscmVhZHkgdmlzaWJsZS5cbiAgICAgICAgY29uc3QgcklkID0gcm9vbUlkID8/IHRoaXMudmlld2VkUm9vbUlkO1xuICAgICAgICBjb25zdCBoaXN0b3J5ID0gY2FyZHMubWFwKChjKSA9PiAoeyBwaGFzZTogYy5waGFzZSwgc3RhdGU6IGMuc3RhdGUgPz8ge30gfSkpO1xuICAgICAgICB0aGlzLmJ5Um9vbVtySWRdID0geyBoaXN0b3J5LCBpc09wZW46IHRydWUgfTtcbiAgICAgICAgdGhpcy5zaG93KHJJZCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgLy8gQXBwZW5kcyBhIGNhcmQgdG8gdGhlIGhpc3RvcnkgYW5kIHNob3dzIHRoZSByaWdodCBwYW5lbCBpZiBub3QgYWxyZWFkeSB2aXNpYmxlXG4gICAgcHVibGljIHB1c2hDYXJkKGNhcmQ6IElSaWdodFBhbmVsQ2FyZCwgYWxsb3dDbG9zZSA9IHRydWUsIHJvb21JZDogc3RyaW5nIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJwdXNoQ2FyZH5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+flwiKVxuICAgICAgICBjb25zdCBySWQgPSByb29tSWQgPz8gdGhpcy52aWV3ZWRSb29tSWQ7XG4gICAgICAgIGNvbnN0IHJlZGlyZWN0ID0gdGhpcy5nZXRWZXJpZmljYXRpb25SZWRpcmVjdChjYXJkKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0UGhhc2UgPSByZWRpcmVjdD8ucGhhc2UgPz8gY2FyZC5waGFzZTtcbiAgICAgICAgY29uc3QgcFN0YXRlID0gcmVkaXJlY3Q/LnN0YXRlID8/IGNhcmQuc3RhdGUgPz8ge307XG5cbiAgICAgICAgLy8gQ2hlY2tzIGZvciB3cm9uZyBTZXRSaWdodFBhbmVsUGhhc2UgcmVxdWVzdHNcbiAgICAgICAgaWYgKCF0aGlzLmlzUGhhc2VWYWxpZCh0YXJnZXRQaGFzZSwgQm9vbGVhbihySWQpKSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHJvb21DYWNoZSA9IHRoaXMuYnlSb29tW3JJZF07XG4gICAgICAgIGlmICghIXJvb21DYWNoZSkge1xuICAgICAgICAgICAgLy8gYXBwZW5kIG5ldyBwaGFzZVxuICAgICAgICAgICAgcm9vbUNhY2hlLmhpc3RvcnkucHVzaCh7IHN0YXRlOiBwU3RhdGUsIHBoYXNlOiB0YXJnZXRQaGFzZSB9KTtcbiAgICAgICAgICAgIHJvb21DYWNoZS5pc09wZW4gPSBhbGxvd0Nsb3NlID8gcm9vbUNhY2hlLmlzT3BlbiA6IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzZXR1cCByb29tIHBhbmVsIGNhY2hlIHdpdGggdGhlIG5ldyBjYXJkXG4gICAgICAgICAgICB0aGlzLmJ5Um9vbVtySWRdID0ge1xuICAgICAgICAgICAgICAgIGhpc3Rvcnk6IFt7IHBoYXNlOiB0YXJnZXRQaGFzZSwgc3RhdGU6IHBTdGF0ZSB9XSxcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGVyZSB3YXMgbm8gcmlnaHQgcGFuZWwgc3RvcmUgb2JqZWN0IHRoZSB0aGUgcGFuZWwgd2FzIGNsb3NlZCAtPiBrZWVwIGl0IGNsb3NlZCwgZXhjZXB0IGlmIGFsbG93Q2xvc2U9PWZhbHNlXG4gICAgICAgICAgICAgICAgaXNPcGVuOiAhYWxsb3dDbG9zZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zaG93KHJJZCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHBvcENhcmQocm9vbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IElSaWdodFBhbmVsQ2FyZCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IHJJZCA9IHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZDtcbiAgICAgICAgaWYgKCF0aGlzLmJ5Um9vbVtySWRdKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgcmVtb3ZlZENhcmQgPSB0aGlzLmJ5Um9vbVtySWRdLmhpc3RvcnkucG9wKCk7XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgICAgIHJldHVybiByZW1vdmVkQ2FyZDtcbiAgICB9XG5cbiAgICBwdWJsaWMgdG9nZ2xlUGFuZWwocm9vbUlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHJJZCA9IHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZDtcbiAgICAgICAgaWYgKCF0aGlzLmJ5Um9vbVtySWRdKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5ieVJvb21bcklkXS5pc09wZW4gPSAhdGhpcy5ieVJvb21bcklkXS5pc09wZW47XG4gICAgICAgIHRoaXMuZW1pdEFuZFVwZGF0ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHNob3cocm9vbUlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc09wZW5Gb3JSb29tKHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZCkpIHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGFuZWwocm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBoaWRlKHJvb21JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5pc09wZW5Gb3JSb29tKHJvb21JZCA/PyB0aGlzLnZpZXdlZFJvb21JZCkpIHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGFuZWwocm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgbG9hZENhY2hlRnJvbVNldHRpbmdzKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy52aWV3ZWRSb29tSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm14Q2xpZW50Py5nZXRSb29tKHRoaXMudmlld2VkUm9vbUlkKTtcbiAgICAgICAgICAgIGlmICghIXJvb20pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsb2JhbCA9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2xvYmFsID8/IGNvbnZlcnRUb1N0YXRlUGFuZWwoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIlJpZ2h0UGFuZWwucGhhc2VzR2xvYmFsXCIpLCByb29tKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF0gPVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF0gPz9cbiAgICAgICAgICAgICAgICAgICAgY29udmVydFRvU3RhdGVQYW5lbChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiUmlnaHRQYW5lbC5waGFzZXNcIiwgdGhpcy52aWV3ZWRSb29tSWQpLCByb29tKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgICAgICAgICAgIFwiQ291bGQgbm90IHJlc3RvcmUgdGhlIHJpZ2h0IHBhbmVsIGFmdGVyIGxvYWQgYmVjYXVzZSB0aGVyZSB3YXMgbm8gYXNzb2NpYXRlZCByb29tIG9iamVjdC5cIixcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBlbWl0QW5kVXBkYXRlU2V0dGluZ3MoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZmlsdGVyVmFsaWRDYXJkcyh0aGlzLmdsb2JhbCk7XG4gICAgICAgIGNvbnN0IHN0b3JlUGFuZWxHbG9iYWwgPSBjb252ZXJ0VG9TdG9yZVBhbmVsKHRoaXMuZ2xvYmFsKTtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS5zZXRWYWx1ZShcIlJpZ2h0UGFuZWwucGhhc2VzR2xvYmFsXCIsIG51bGwsIFNldHRpbmdMZXZlbC5ERVZJQ0UsIHN0b3JlUGFuZWxHbG9iYWwpO1xuXG4gICAgICAgIGlmICghIXRoaXMudmlld2VkUm9vbUlkKSB7XG4gICAgICAgICAgICBjb25zdCBwYW5lbFRoaXNSb29tID0gdGhpcy5ieVJvb21bdGhpcy52aWV3ZWRSb29tSWRdO1xuICAgICAgICAgICAgdGhpcy5maWx0ZXJWYWxpZENhcmRzKHBhbmVsVGhpc1Jvb20pO1xuICAgICAgICAgICAgY29uc3Qgc3RvcmVQYW5lbFRoaXNSb29tID0gY29udmVydFRvU3RvcmVQYW5lbChwYW5lbFRoaXNSb29tKTtcbiAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgXCJSaWdodFBhbmVsLnBoYXNlc1wiLFxuICAgICAgICAgICAgICAgIHRoaXMudmlld2VkUm9vbUlkLFxuICAgICAgICAgICAgICAgIFNldHRpbmdMZXZlbC5ST09NX0RFVklDRSxcbiAgICAgICAgICAgICAgICBzdG9yZVBhbmVsVGhpc1Jvb20sXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW1pdChVUERBVEVfRVZFTlQsIG51bGwpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZmlsdGVyVmFsaWRDYXJkcyhyaWdodFBhbmVsRm9yUm9vbT86IElSaWdodFBhbmVsRm9yUm9vbSk6IHZvaWQge1xuICAgICAgICBpZiAoIXJpZ2h0UGFuZWxGb3JSb29tPy5oaXN0b3J5KSByZXR1cm47XG4gICAgICAgIHJpZ2h0UGFuZWxGb3JSb29tLmhpc3RvcnkgPSByaWdodFBhbmVsRm9yUm9vbS5oaXN0b3J5LmZpbHRlcigoY2FyZCkgPT4gdGhpcy5pc0NhcmRTdGF0ZVZhbGlkKGNhcmQpKTtcbiAgICAgICAgaWYgKCFyaWdodFBhbmVsRm9yUm9vbS5oaXN0b3J5Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmlnaHRQYW5lbEZvclJvb20uaXNPcGVuID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGlzQ2FyZFN0YXRlVmFsaWQoY2FyZDogSVJpZ2h0UGFuZWxDYXJkKTogYm9vbGVhbiB7XG4gICAgICAgIC8vIHRoaXMgZnVuY3Rpb24gZG9lcyBhIHNhbml0eSBjaGVjayBvbiB0aGUgY2FyZC4gdGhpcyBpcyByZXF1aXJlZCBiZWNhdXNlXG4gICAgICAgIC8vIHNvbWUgcGhhc2VzIHJlcXVpcmUgc3BlY2lmaWMgc3RhdGUgcHJvcGVydGllcyB0aGF0IG1pZ2h0IG5vdCBiZSBhdmFpbGFibGUuXG4gICAgICAgIC8vIFRoaXMgY2FuIGJlIGNhdXNlZCBvbiBpZiBlbGVtZW50IGlzIHJlbG9hZGVkIGFuZCB0aGUgdHJpZXMgdG8gcmVsb2FkIHJpZ2h0IHBhbmVsIGRhdGEgZnJvbSBpZCdzIHN0b3JlZCBpbiB0aGUgbG9jYWwgc3RvcmFnZS5cbiAgICAgICAgLy8gd2Ugc3RvcmUgaWQncyBvZiB1c2VycyBhbmQgbWF0cml4IGV2ZW50cy4gSWYgYXJlIG5vdCB5ZXQgZmV0Y2hlZCBvbiByZWxvYWQgdGhlIHJpZ2h0IHBhbmVsIGNhbm5vdCBkaXNwbGF5IHRoZW0uXG4gICAgICAgIC8vIG9yIHBvdGVudGlhbGx5IG90aGVyIGVycm9ycy5cbiAgICAgICAgLy8gKEEgbmljZXIgZml4IGNvdWxkIGJlIHRvIGluZGljYXRlLCB0aGF0IHRoZSByaWdodCBwYW5lbCBpcyBsb2FkaW5nIGlmIHRoZXJlIGlzIG1pc3Npbmcgc3RhdGUgZGF0YSBhbmQgcmUtZW1pdCBpZiB0aGUgZGF0YSBpcyBhdmFpbGFibGUpXG4gICAgICAgIHN3aXRjaCAoY2FyZC5waGFzZSkge1xuICAgICAgICAgICAgY2FzZSBSaWdodFBhbmVsUGhhc2VzLlRocmVhZFZpZXc6XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy50aHJlYWRIZWFkRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJyZW1vdmVkIGNhcmQgZnJvbSByaWdodCBwYW5lbCBiZWNhdXNlIG9mIG1pc3NpbmcgdGhyZWFkSGVhZEV2ZW50IGluIGNhcmQgc3RhdGVcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhIWNhcmQuc3RhdGU/LnRocmVhZEhlYWRFdmVudDtcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5Sb29tTWVtYmVySW5mbzpcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5TcGFjZU1lbWJlckluZm86XG4gICAgICAgICAgICBjYXNlIFJpZ2h0UGFuZWxQaGFzZXMuRW5jcnlwdGlvblBhbmVsOlxuICAgICAgICAgICAgICAgIGlmICghY2FyZC5zdGF0ZT8ubWVtYmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKFwicmVtb3ZlZCBjYXJkIGZyb20gcmlnaHQgcGFuZWwgYmVjYXVzZSBvZiBtaXNzaW5nIG1lbWJlciBpbiBjYXJkIHN0YXRlXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gISFjYXJkLnN0YXRlPy5tZW1iZXI7XG4gICAgICAgICAgICBjYXNlIFJpZ2h0UGFuZWxQaGFzZXMuUm9vbTNwaWRNZW1iZXJJbmZvOlxuICAgICAgICAgICAgY2FzZSBSaWdodFBhbmVsUGhhc2VzLlNwYWNlM3BpZE1lbWJlckluZm86XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy5tZW1iZXJJbmZvRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJyZW1vdmVkIGNhcmQgZnJvbSByaWdodCBwYW5lbCBiZWNhdXNlIG9mIG1pc3NpbmcgbWVtYmVySW5mb0V2ZW50IGluIGNhcmQgc3RhdGVcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAhIWNhcmQuc3RhdGU/Lm1lbWJlckluZm9FdmVudDtcbiAgICAgICAgICAgIGNhc2UgUmlnaHRQYW5lbFBoYXNlcy5XaWRnZXQ6XG4gICAgICAgICAgICAgICAgaWYgKCFjYXJkLnN0YXRlPy53aWRnZXRJZCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybihcInJlbW92ZWQgY2FyZCBmcm9tIHJpZ2h0IHBhbmVsIGJlY2F1c2Ugb2YgbWlzc2luZyB3aWRnZXRJZCBpbiBjYXJkIHN0YXRlXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gISFjYXJkLnN0YXRlPy53aWRnZXRJZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFZlcmlmaWNhdGlvblJlZGlyZWN0KGNhcmQ6IElSaWdodFBhbmVsQ2FyZCk6IElSaWdodFBhbmVsQ2FyZCB8IG51bGwge1xuICAgICAgICBpZiAoY2FyZC5waGFzZSA9PT0gUmlnaHRQYW5lbFBoYXNlcy5Sb29tTWVtYmVySW5mbyAmJiBjYXJkLnN0YXRlKSB7XG4gICAgICAgICAgICAvLyBSaWdodFBhbmVsUGhhc2VzLlJvb21NZW1iZXJJbmZvIC0+IG5lZWRzIHRvIGJlIGNoYW5nZWQgdG8gUmlnaHRQYW5lbFBoYXNlcy5FbmNyeXB0aW9uUGFuZWwgaWYgdGhlcmUgaXMgYSBwZW5kaW5nIHZlcmlmaWNhdGlvbiByZXF1ZXN0XG4gICAgICAgICAgICBjb25zdCB7IG1lbWJlciB9ID0gY2FyZC5zdGF0ZTtcbiAgICAgICAgICAgIGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gbWVtYmVyXG4gICAgICAgICAgICAgICAgPyBwZW5kaW5nVmVyaWZpY2F0aW9uUmVxdWVzdEZvclVzZXIoTWF0cml4Q2xpZW50UGVnLmdldCgpLCBtZW1iZXIpXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAocGVuZGluZ1JlcXVlc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBwaGFzZTogUmlnaHRQYW5lbFBoYXNlcy5FbmNyeXB0aW9uUGFuZWwsXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25SZXF1ZXN0OiBwZW5kaW5nUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbWJlcixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNQaGFzZVZhbGlkKHRhcmdldFBoYXNlOiBSaWdodFBhbmVsUGhhc2VzIHwgbnVsbCwgaXNWaWV3aW5nUm9vbTogYm9vbGVhbik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRhcmdldFBoYXNlIHx8ICFSaWdodFBhbmVsUGhhc2VzW3RhcmdldFBoYXNlXSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYFRyaWVkIHRvIHN3aXRjaCByaWdodCBwYW5lbCB0byB1bmtub3duIHBoYXNlOiAke3RhcmdldFBoYXNlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNWaWV3aW5nUm9vbSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgICAgICAgYFRyaWVkIHRvIHN3aXRjaCByaWdodCBwYW5lbCB0byBhIHJvb20gcGhhc2U6ICR7dGFyZ2V0UGhhc2V9LCBgICtcbiAgICAgICAgICAgICAgICAgICAgYGJ1dCB3ZSBhcmUgY3VycmVudGx5IG5vdCB2aWV3aW5nIGEgcm9vbWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25WZXJpZmljYXRpb25SZXF1ZXN0VXBkYXRlID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuY3VycmVudENhcmQ/LnN0YXRlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHsgbWVtYmVyIH0gPSB0aGlzLmN1cnJlbnRDYXJkLnN0YXRlO1xuICAgICAgICBpZiAoIW1lbWJlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBwZW5kaW5nUmVxdWVzdCA9IHBlbmRpbmdWZXJpZmljYXRpb25SZXF1ZXN0Rm9yVXNlcihNYXRyaXhDbGllbnRQZWcuZ2V0KCksIG1lbWJlcik7XG4gICAgICAgIGlmIChwZW5kaW5nUmVxdWVzdCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS52ZXJpZmljYXRpb25SZXF1ZXN0ID0gcGVuZGluZ1JlcXVlc3Q7XG4gICAgICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgaGFuZGxlVmlld2VkUm9vbUNoYW5nZShvbGRSb29tSWQ6IE9wdGlvbmFsPHN0cmluZz4sIG5ld1Jvb21JZDogT3B0aW9uYWw8c3RyaW5nPik6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMubXhDbGllbnQpIHJldHVybjsgLy8gbm90IHJlYWR5LCBvblJlYWR5IHdpbGwgaGFuZGxlIHRoZSBmaXJzdCByb29tXG4gICAgICAgIHRoaXMudmlld2VkUm9vbUlkID0gbmV3Um9vbUlkO1xuICAgICAgICAvLyBsb2FkIHZhbHVlcyBmcm9tIGJ5Um9vbUNhY2hlIHdpdGggdGhlIHZpZXdlZFJvb21JZC5cbiAgICAgICAgdGhpcy5sb2FkQ2FjaGVGcm9tU2V0dGluZ3MoKTtcblxuICAgICAgICAvLyB3aGVuIHdlJ3JlIHN3aXRjaGluZyB0byBhIHJvb20sIGNsZWFyIG91dCBhbnkgc3RhbGUgTWVtYmVySW5mbyBjYXJkc1xuICAgICAgICAvLyBpbiBvcmRlciB0byBmaXggaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMjE0ODdcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQ/LnBoYXNlICE9PSBSaWdodFBhbmVsUGhhc2VzLkVuY3J5cHRpb25QYW5lbCkge1xuICAgICAgICAgICAgY29uc3QgcGFuZWwgPSB0aGlzLmJ5Um9vbVt0aGlzLnZpZXdlZFJvb21JZF07XG4gICAgICAgICAgICBpZiAocGFuZWw/Lmhpc3RvcnkpIHtcbiAgICAgICAgICAgICAgICBwYW5lbC5oaXN0b3J5ID0gcGFuZWwuaGlzdG9yeS5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgIChjYXJkKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZC5waGFzZSAhPSBSaWdodFBhbmVsUGhhc2VzLlJvb21NZW1iZXJJbmZvICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkLnBoYXNlICE9IFJpZ2h0UGFuZWxQaGFzZXMuUm9vbTNwaWRNZW1iZXJJbmZvLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gd2hlbiB3ZSdyZSBzd2l0Y2hpbmcgdG8gYSByb29tLCBjbGVhciBvdXQgdGhyZWFkIHBlcm1hbGlua3MgdG8gbm90IGdldCB5b3Ugc3R1Y2sgaW4gdGhlIG1pZGRsZSBvZiB0aGUgdGhyZWFkXG4gICAgICAgIC8vIGluIG9yZGVyIHRvIGZpeCBodHRwczovL2dpdGh1Yi5jb20vbWF0cml4LW9yZy9tYXRyaXgtcmVhY3Qtc2RrL3B1bGwvMTEwMTFcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQ/LnBoYXNlID09PSBSaWdodFBhbmVsUGhhc2VzLlRocmVhZFZpZXcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuc3RhdGUuaW5pdGlhbEV2ZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS5pc0luaXRpYWxFdmVudEhpZ2hsaWdodGVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5zdGF0ZS5pbml0aWFsRXZlbnRTY3JvbGxJbnRvVmlldyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoZSByaWdodCBwYW5lbCBzdGF5cyBvcGVuIG1vZGUgaXMgdXNlZCwgYW5kIHRoZSBwYW5lbCB3YXMgZWl0aGVyXG4gICAgICAgIC8vIGNsb3NlZCBvciBuZXZlciBzaG93biBmb3IgdGhhdCByb29tLCB0aGVuIGZvcmNlIGl0IG9wZW4gYW5kIGRpc3BsYXlcbiAgICAgICAgLy8gdGhlIHJvb20gbWVtYmVyIGxpc3QuXG4gICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9yaWdodF9wYW5lbF9kZWZhdWx0X29wZW5cIikgJiYgIXRoaXMuYnlSb29tW3RoaXMudmlld2VkUm9vbUlkXT8uaXNPcGVuKSB7XG4gICAgICAgICAgICBjb25zdCBoaXN0b3J5ID0gW3sgcGhhc2U6IFJpZ2h0UGFuZWxQaGFzZXMuUm9vbU1lbWJlckxpc3QgfV07XG4gICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy52aWV3ZWRSb29tSWQgPyB0aGlzLm14Q2xpZW50Py5nZXRSb29tKHRoaXMudmlld2VkUm9vbUlkKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICghcm9vbT8uaXNTcGFjZVJvb20oKSkge1xuICAgICAgICAgICAgICAgIGhpc3RvcnkudW5zaGlmdCh7IHBoYXNlOiBSaWdodFBhbmVsUGhhc2VzLlJvb21TdW1tYXJ5IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ieVJvb21bdGhpcy52aWV3ZWRSb29tSWRdID0ge1xuICAgICAgICAgICAgICAgIGlzT3BlbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBoaXN0b3J5LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVtaXRBbmRVcGRhdGVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0IGluc3RhbmNlKCk6IFJpZ2h0UGFuZWxTdG9yZSB7XG4gICAgICAgIGlmICghdGhpcy5pbnRlcm5hbEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsSW5zdGFuY2UgPSBuZXcgUmlnaHRQYW5lbFN0b3JlKCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsSW5zdGFuY2Uuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcm5hbEluc3RhbmNlO1xuICAgIH1cbn1cblxud2luZG93Lm14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