"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.abbreviateUrl = abbreviateUrl;
exports.parseUrl = parseUrl;
exports.unabbreviateUrl = unabbreviateUrl;
/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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
 * If a url has no path component, etc. abbreviate it to just the hostname
 *
 * @param {string} u The url to be abbreviated
 * @returns {string} The abbreviated url
 */
function abbreviateUrl(u) {
  if (!u) return "";
  let parsedUrl;
  try {
    parsedUrl = parseUrl(u);
  } catch (e) {
    console.error(e);
    // if it's something we can't parse as a url then just return it
    return u;
  }
  if (parsedUrl.pathname === "/") {
    // we ignore query / hash parts: these aren't relevant for IS server URLs
    return parsedUrl.host || "";
  }
  return u;
}
function unabbreviateUrl(u) {
  if (!u) return "";
  let longUrl = u;
  if (!u.startsWith("https://")) longUrl = "https://" + u;
  const parsed = parseUrl(longUrl);
  if (!parsed.hostname) return u;
  return longUrl;
}
function parseUrl(u) {
  if (!u.includes(":")) {
    u = window.location.protocol + u;
  }
  return new URL(u);
}
//# sourceMappingURL=UrlUtils.js.map