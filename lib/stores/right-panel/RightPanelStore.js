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
//# sourceMappingURL=RightPanelStore.js.map