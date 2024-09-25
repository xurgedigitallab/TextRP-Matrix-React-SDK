"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.options = exports.linkify = exports._linkifyString = exports._linkifyElement = exports.Type = exports.ELEMENT_URL_PATTERN = void 0;
var linkifyjs = _interopRequireWildcard(require("linkifyjs"));
var _linkifyElement2 = _interopRequireDefault(require("linkify-element"));
var _linkifyString2 = _interopRequireDefault(require("linkify-string"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _Permalinks = require("./utils/permalinks/Permalinks");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _actions = require("./dispatcher/actions");
var _MatrixClientPeg = require("./MatrixClientPeg");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
let Type = /*#__PURE__*/function (Type) {
  Type["URL"] = "url";
  Type["UserId"] = "userid";
  Type["RoomAlias"] = "roomalias";
  return Type;
}({}); // Linkify stuff doesn't type scanner/parser/utils properly :/
exports.Type = Type;
function matrixOpaqueIdLinkifyParser(_ref) {
  let {
    scanner,
    parser,
    utils,
    token,
    name
  } = _ref;
  const {
    DOT,
    // IPV4 necessity
    NUM,
    TLD,
    COLON,
    SYM,
    SLASH,
    EQUALS,
    HYPHEN,
    UNDERSCORE,
    // because 'localhost' is tokenised to the localhost token,
    // usernames @localhost:foo.com are otherwise not matched!
    LOCALHOST,
    domain
  } = scanner.tokens;
  const S_START = parser.start;
  const matrixSymbol = utils.createTokenClass(name, {
    isLink: true
  });
  const localpartTokens = [domain, TLD, DOT, LOCALHOST, SYM, SLASH, EQUALS, UNDERSCORE, HYPHEN];
  const domainpartTokens = [domain, TLD, LOCALHOST, HYPHEN];
  const INITIAL_STATE = S_START.tt(token);
  const LOCALPART_STATE = INITIAL_STATE.tt(domain);
  for (const token of localpartTokens) {
    INITIAL_STATE.tt(token, LOCALPART_STATE);
    LOCALPART_STATE.tt(token, LOCALPART_STATE);
  }
  const LOCALPART_STATE_DOT = LOCALPART_STATE.tt(DOT);
  for (const token of localpartTokens) {
    LOCALPART_STATE_DOT.tt(token, LOCALPART_STATE);
  }
  const DOMAINPART_STATE_DOT = LOCALPART_STATE.tt(COLON);
  const DOMAINPART_STATE = DOMAINPART_STATE_DOT.tt(domain);
  DOMAINPART_STATE.tt(DOT, DOMAINPART_STATE_DOT);
  for (const token of domainpartTokens) {
    DOMAINPART_STATE.tt(token, DOMAINPART_STATE);
    // we are done if we have a domain
    DOMAINPART_STATE.tt(token, matrixSymbol);
  }

  // accept repeated TLDs (e.g .org.uk) but do not accept double dots: ..
  for (const token of domainpartTokens) {
    DOMAINPART_STATE_DOT.tt(token, DOMAINPART_STATE);
  }
  const PORT_STATE = DOMAINPART_STATE.tt(COLON);
  PORT_STATE.tt(NUM, matrixSymbol);
}
function onUserClick(event, userId) {
  event.preventDefault();
  _dispatcher.default.dispatch({
    action: _actions.Action.ViewUser,
    member: new _matrix.User(userId)
  });
}
function onAliasClick(event, roomAlias) {
  event.preventDefault();
  _dispatcher.default.dispatch({
    action: _actions.Action.ViewRoom,
    room_alias: roomAlias,
    metricsTrigger: "Timeline",
    metricsViaKeyboard: false
  });
}
const escapeRegExp = function (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Recognise URLs from both our local and official Element deployments.
// Anyone else really should be using matrix.to. vector:// allowed to support Element Desktop relative links.
const ELEMENT_URL_PATTERN = "^(?:vector://|https?://)?(?:" + escapeRegExp(window.location.host + window.location.pathname) + "|" + "(?:www\\.)?(?:riot|vector)\\.im/(?:app|beta|staging|develop)/|" + "(?:app|beta|staging|develop)\\.element\\.io/" + ")(#.*)";
exports.ELEMENT_URL_PATTERN = ELEMENT_URL_PATTERN;
const options = {
  events: function (href, type) {
    switch (type) {
      case Type.URL:
        {
          // intercept local permalinks to users and show them like userids (in userinfo of current room)
          try {
            const permalink = (0, _Permalinks.parsePermalink)(href);
            if (permalink?.userId) {
              return {
                // @ts-ignore see https://linkify.js.org/docs/options.html
                click: function (e) {
                  onUserClick(e, permalink.userId);
                }
              };
            } else {
              // for events, rooms etc. (anything other than users)
              const localHref = (0, _Permalinks.tryTransformPermalinkToLocalHref)(href);
              if (localHref !== href) {
                // it could be converted to a localHref -> therefore handle locally
                return {
                  // @ts-ignore see https://linkify.js.org/docs/options.html
                  click: function (e) {
                    e.preventDefault();
                    window.location.hash = localHref;
                  }
                };
              }
            }
          } catch (e) {
            // OK fine, it's not actually a permalink
          }
          break;
        }
      case Type.UserId:
        return {
          // @ts-ignore see https://linkify.js.org/docs/options.html
          click: function (e) {
            const userId = (0, _Permalinks.parsePermalink)(href)?.userId;
            if (userId) onUserClick(e, userId);
          }
        };
      case Type.RoomAlias:
        return {
          // @ts-ignore see https://linkify.js.org/docs/options.html
          click: function (e) {
            const alias = (0, _Permalinks.parsePermalink)(href)?.roomIdOrAlias;
            if (alias) onAliasClick(e, alias);
          }
        };
    }
    return {};
  },
  formatHref: function (href, type) {
    switch (type) {
      case Type.RoomAlias:
      case Type.UserId:
      default:
        {
          return (0, _Permalinks.tryTransformEntityToPermalink)(_MatrixClientPeg.MatrixClientPeg.get(), href) ?? "";
        }
    }
  },
  attributes: {
    rel: "noreferrer noopener"
  },
  ignoreTags: ["pre", "code"],
  className: "linkified",
  target: function (href, type) {
    if (type === Type.URL) {
      try {
        const transformed = (0, _Permalinks.tryTransformPermalinkToLocalHref)(href);
        if (transformed !== href ||
        // if it could be converted to handle locally for matrix symbols e.g. @user:server.tdl and matrix.to
        decodeURIComponent(href).match(ELEMENT_URL_PATTERN) // for https links to Element domains
        ) {
          return "";
        } else {
          return "_blank";
        }
      } catch (e) {
        // malformed URI
      }
    }
    return "";
  }
};

// Run the plugins
exports.options = options;
(0, linkifyjs.registerPlugin)(Type.RoomAlias, _ref2 => {
  let {
    scanner,
    parser,
    utils
  } = _ref2;
  const token = scanner.tokens.POUND;
  matrixOpaqueIdLinkifyParser({
    scanner,
    parser,
    utils,
    token,
    name: Type.RoomAlias
  });
});
(0, linkifyjs.registerPlugin)(Type.UserId, _ref3 => {
  let {
    scanner,
    parser,
    utils
  } = _ref3;
  const token = scanner.tokens.AT;
  matrixOpaqueIdLinkifyParser({
    scanner,
    parser,
    utils,
    token,
    name: Type.UserId
  });
});
(0, linkifyjs.registerCustomProtocol)("matrix", true);
const linkify = linkifyjs;
exports.linkify = linkify;
const _linkifyElement = _linkifyElement2.default;
exports._linkifyElement = _linkifyElement;
const _linkifyString = _linkifyString2.default;
exports._linkifyString = _linkifyString;
//# sourceMappingURL=linkify-matrix.js.map