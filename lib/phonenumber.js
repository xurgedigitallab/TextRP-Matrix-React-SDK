"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEmojiFlag = exports.COUNTRIES = void 0;
exports.looksValid = looksValid;
var _languageHandler = require("./languageHandler");
/*
Copyright 2017 Vector Creations Ltd

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

const PHONE_NUMBER_REGEXP = /^[0-9 -.]+$/;

/*
 * Do basic validation to determine if the given input could be
 * a valid phone number.
 *
 * @param {String} phoneNumber The string to validate. This could be
 *     either an international format number (MSISDN or e.164) or
 *     a national-format number.
 * @return True if the number could be a valid phone number, otherwise false.
 */
function looksValid(phoneNumber) {
  return PHONE_NUMBER_REGEXP.test(phoneNumber);
}

// Regional Indicator Symbol Letter A
const UNICODE_BASE = 127462 - "A".charCodeAt(0);
// Country code should be exactly 2 uppercase characters
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const getEmojiFlag = countryCode => {
  if (!COUNTRY_CODE_REGEX.test(countryCode)) return "";
  // Rip the country code out of the emoji and use that
  return String.fromCodePoint(...countryCode.split("").map(l => UNICODE_BASE + l.charCodeAt(0)));
};
exports.getEmojiFlag = getEmojiFlag;
const COUNTRIES = [{
  iso2: "GB",
  name: (0, _languageHandler._td)("United Kingdom"),
  prefix: "44"
}, {
  iso2: "US",
  name: (0, _languageHandler._td)("United States"),
  prefix: "1"
}, {
  iso2: "AF",
  name: (0, _languageHandler._td)("Afghanistan"),
  prefix: "93"
}, {
  iso2: "AX",
  name: (0, _languageHandler._td)("\u00c5land Islands"),
  prefix: "358"
}, {
  iso2: "AL",
  name: (0, _languageHandler._td)("Albania"),
  prefix: "355"
}, {
  iso2: "DZ",
  name: (0, _languageHandler._td)("Algeria"),
  prefix: "213"
}, {
  iso2: "AS",
  name: (0, _languageHandler._td)("American Samoa"),
  prefix: "1"
}, {
  iso2: "AD",
  name: (0, _languageHandler._td)("Andorra"),
  prefix: "376"
}, {
  iso2: "AO",
  name: (0, _languageHandler._td)("Angola"),
  prefix: "244"
}, {
  iso2: "AI",
  name: (0, _languageHandler._td)("Anguilla"),
  prefix: "1"
}, {
  iso2: "AQ",
  name: (0, _languageHandler._td)("Antarctica"),
  prefix: "672"
}, {
  iso2: "AG",
  name: (0, _languageHandler._td)("Antigua & Barbuda"),
  prefix: "1"
}, {
  iso2: "AR",
  name: (0, _languageHandler._td)("Argentina"),
  prefix: "54"
}, {
  iso2: "AM",
  name: (0, _languageHandler._td)("Armenia"),
  prefix: "374"
}, {
  iso2: "AW",
  name: (0, _languageHandler._td)("Aruba"),
  prefix: "297"
}, {
  iso2: "AU",
  name: (0, _languageHandler._td)("Australia"),
  prefix: "61"
}, {
  iso2: "AT",
  name: (0, _languageHandler._td)("Austria"),
  prefix: "43"
}, {
  iso2: "AZ",
  name: (0, _languageHandler._td)("Azerbaijan"),
  prefix: "994"
}, {
  iso2: "BS",
  name: (0, _languageHandler._td)("Bahamas"),
  prefix: "1"
}, {
  iso2: "BH",
  name: (0, _languageHandler._td)("Bahrain"),
  prefix: "973"
}, {
  iso2: "BD",
  name: (0, _languageHandler._td)("Bangladesh"),
  prefix: "880"
}, {
  iso2: "BB",
  name: (0, _languageHandler._td)("Barbados"),
  prefix: "1"
}, {
  iso2: "BY",
  name: (0, _languageHandler._td)("Belarus"),
  prefix: "375"
}, {
  iso2: "BE",
  name: (0, _languageHandler._td)("Belgium"),
  prefix: "32"
}, {
  iso2: "BZ",
  name: (0, _languageHandler._td)("Belize"),
  prefix: "501"
}, {
  iso2: "BJ",
  name: (0, _languageHandler._td)("Benin"),
  prefix: "229"
}, {
  iso2: "BM",
  name: (0, _languageHandler._td)("Bermuda"),
  prefix: "1"
}, {
  iso2: "BT",
  name: (0, _languageHandler._td)("Bhutan"),
  prefix: "975"
}, {
  iso2: "BO",
  name: (0, _languageHandler._td)("Bolivia"),
  prefix: "591"
}, {
  iso2: "BA",
  name: (0, _languageHandler._td)("Bosnia"),
  prefix: "387"
}, {
  iso2: "BW",
  name: (0, _languageHandler._td)("Botswana"),
  prefix: "267"
}, {
  iso2: "BV",
  name: (0, _languageHandler._td)("Bouvet Island"),
  prefix: "47"
}, {
  iso2: "BR",
  name: (0, _languageHandler._td)("Brazil"),
  prefix: "55"
}, {
  iso2: "IO",
  name: (0, _languageHandler._td)("British Indian Ocean Territory"),
  prefix: "246"
}, {
  iso2: "VG",
  name: (0, _languageHandler._td)("British Virgin Islands"),
  prefix: "1"
}, {
  iso2: "BN",
  name: (0, _languageHandler._td)("Brunei"),
  prefix: "673"
}, {
  iso2: "BG",
  name: (0, _languageHandler._td)("Bulgaria"),
  prefix: "359"
}, {
  iso2: "BF",
  name: (0, _languageHandler._td)("Burkina Faso"),
  prefix: "226"
}, {
  iso2: "BI",
  name: (0, _languageHandler._td)("Burundi"),
  prefix: "257"
}, {
  iso2: "KH",
  name: (0, _languageHandler._td)("Cambodia"),
  prefix: "855"
}, {
  iso2: "CM",
  name: (0, _languageHandler._td)("Cameroon"),
  prefix: "237"
}, {
  iso2: "CA",
  name: (0, _languageHandler._td)("Canada"),
  prefix: "1"
}, {
  iso2: "CV",
  name: (0, _languageHandler._td)("Cape Verde"),
  prefix: "238"
}, {
  iso2: "BQ",
  name: (0, _languageHandler._td)("Caribbean Netherlands"),
  prefix: "599"
}, {
  iso2: "KY",
  name: (0, _languageHandler._td)("Cayman Islands"),
  prefix: "1"
}, {
  iso2: "CF",
  name: (0, _languageHandler._td)("Central African Republic"),
  prefix: "236"
}, {
  iso2: "TD",
  name: (0, _languageHandler._td)("Chad"),
  prefix: "235"
}, {
  iso2: "CL",
  name: (0, _languageHandler._td)("Chile"),
  prefix: "56"
}, {
  iso2: "CN",
  name: (0, _languageHandler._td)("China"),
  prefix: "86"
}, {
  iso2: "CX",
  name: (0, _languageHandler._td)("Christmas Island"),
  prefix: "61"
}, {
  iso2: "CC",
  name: (0, _languageHandler._td)("Cocos (Keeling) Islands"),
  prefix: "61"
}, {
  iso2: "CO",
  name: (0, _languageHandler._td)("Colombia"),
  prefix: "57"
}, {
  iso2: "KM",
  name: (0, _languageHandler._td)("Comoros"),
  prefix: "269"
}, {
  iso2: "CG",
  name: (0, _languageHandler._td)("Congo - Brazzaville"),
  prefix: "242"
}, {
  iso2: "CD",
  name: (0, _languageHandler._td)("Congo - Kinshasa"),
  prefix: "243"
}, {
  iso2: "CK",
  name: (0, _languageHandler._td)("Cook Islands"),
  prefix: "682"
}, {
  iso2: "CR",
  name: (0, _languageHandler._td)("Costa Rica"),
  prefix: "506"
}, {
  iso2: "HR",
  name: (0, _languageHandler._td)("Croatia"),
  prefix: "385"
}, {
  iso2: "CU",
  name: (0, _languageHandler._td)("Cuba"),
  prefix: "53"
}, {
  iso2: "CW",
  name: (0, _languageHandler._td)("Cura\u00e7ao"),
  prefix: "599"
}, {
  iso2: "CY",
  name: (0, _languageHandler._td)("Cyprus"),
  prefix: "357"
}, {
  iso2: "CZ",
  name: (0, _languageHandler._td)("Czech Republic"),
  prefix: "420"
}, {
  iso2: "CI",
  name: (0, _languageHandler._td)("C\u00f4te d\u2019Ivoire"),
  prefix: "225"
}, {
  iso2: "DK",
  name: (0, _languageHandler._td)("Denmark"),
  prefix: "45"
}, {
  iso2: "DJ",
  name: (0, _languageHandler._td)("Djibouti"),
  prefix: "253"
}, {
  iso2: "DM",
  name: (0, _languageHandler._td)("Dominica"),
  prefix: "1"
}, {
  iso2: "DO",
  name: (0, _languageHandler._td)("Dominican Republic"),
  prefix: "1"
}, {
  iso2: "EC",
  name: (0, _languageHandler._td)("Ecuador"),
  prefix: "593"
}, {
  iso2: "EG",
  name: (0, _languageHandler._td)("Egypt"),
  prefix: "20"
}, {
  iso2: "SV",
  name: (0, _languageHandler._td)("El Salvador"),
  prefix: "503"
}, {
  iso2: "GQ",
  name: (0, _languageHandler._td)("Equatorial Guinea"),
  prefix: "240"
}, {
  iso2: "ER",
  name: (0, _languageHandler._td)("Eritrea"),
  prefix: "291"
}, {
  iso2: "EE",
  name: (0, _languageHandler._td)("Estonia"),
  prefix: "372"
}, {
  iso2: "ET",
  name: (0, _languageHandler._td)("Ethiopia"),
  prefix: "251"
}, {
  iso2: "FK",
  name: (0, _languageHandler._td)("Falkland Islands"),
  prefix: "500"
}, {
  iso2: "FO",
  name: (0, _languageHandler._td)("Faroe Islands"),
  prefix: "298"
}, {
  iso2: "FJ",
  name: (0, _languageHandler._td)("Fiji"),
  prefix: "679"
}, {
  iso2: "FI",
  name: (0, _languageHandler._td)("Finland"),
  prefix: "358"
}, {
  iso2: "FR",
  name: (0, _languageHandler._td)("France"),
  prefix: "33"
}, {
  iso2: "GF",
  name: (0, _languageHandler._td)("French Guiana"),
  prefix: "594"
}, {
  iso2: "PF",
  name: (0, _languageHandler._td)("French Polynesia"),
  prefix: "689"
}, {
  iso2: "TF",
  name: (0, _languageHandler._td)("French Southern Territories"),
  prefix: "262"
}, {
  iso2: "GA",
  name: (0, _languageHandler._td)("Gabon"),
  prefix: "241"
}, {
  iso2: "GM",
  name: (0, _languageHandler._td)("Gambia"),
  prefix: "220"
}, {
  iso2: "GE",
  name: (0, _languageHandler._td)("Georgia"),
  prefix: "995"
}, {
  iso2: "DE",
  name: (0, _languageHandler._td)("Germany"),
  prefix: "49"
}, {
  iso2: "GH",
  name: (0, _languageHandler._td)("Ghana"),
  prefix: "233"
}, {
  iso2: "GI",
  name: (0, _languageHandler._td)("Gibraltar"),
  prefix: "350"
}, {
  iso2: "GR",
  name: (0, _languageHandler._td)("Greece"),
  prefix: "30"
}, {
  iso2: "GL",
  name: (0, _languageHandler._td)("Greenland"),
  prefix: "299"
}, {
  iso2: "GD",
  name: (0, _languageHandler._td)("Grenada"),
  prefix: "1"
}, {
  iso2: "GP",
  name: (0, _languageHandler._td)("Guadeloupe"),
  prefix: "590"
}, {
  iso2: "GU",
  name: (0, _languageHandler._td)("Guam"),
  prefix: "1"
}, {
  iso2: "GT",
  name: (0, _languageHandler._td)("Guatemala"),
  prefix: "502"
}, {
  iso2: "GG",
  name: (0, _languageHandler._td)("Guernsey"),
  prefix: "44"
}, {
  iso2: "GN",
  name: (0, _languageHandler._td)("Guinea"),
  prefix: "224"
}, {
  iso2: "GW",
  name: (0, _languageHandler._td)("Guinea-Bissau"),
  prefix: "245"
}, {
  iso2: "GY",
  name: (0, _languageHandler._td)("Guyana"),
  prefix: "592"
}, {
  iso2: "HT",
  name: (0, _languageHandler._td)("Haiti"),
  prefix: "509"
}, {
  iso2: "HM",
  name: (0, _languageHandler._td)("Heard & McDonald Islands"),
  prefix: "672"
}, {
  iso2: "HN",
  name: (0, _languageHandler._td)("Honduras"),
  prefix: "504"
}, {
  iso2: "HK",
  name: (0, _languageHandler._td)("Hong Kong"),
  prefix: "852"
}, {
  iso2: "HU",
  name: (0, _languageHandler._td)("Hungary"),
  prefix: "36"
}, {
  iso2: "IS",
  name: (0, _languageHandler._td)("Iceland"),
  prefix: "354"
}, {
  iso2: "IN",
  name: (0, _languageHandler._td)("India"),
  prefix: "91"
}, {
  iso2: "ID",
  name: (0, _languageHandler._td)("Indonesia"),
  prefix: "62"
}, {
  iso2: "IR",
  name: (0, _languageHandler._td)("Iran"),
  prefix: "98"
}, {
  iso2: "IQ",
  name: (0, _languageHandler._td)("Iraq"),
  prefix: "964"
}, {
  iso2: "IE",
  name: (0, _languageHandler._td)("Ireland"),
  prefix: "353"
}, {
  iso2: "IM",
  name: (0, _languageHandler._td)("Isle of Man"),
  prefix: "44"
}, {
  iso2: "IL",
  name: (0, _languageHandler._td)("Israel"),
  prefix: "972"
}, {
  iso2: "IT",
  name: (0, _languageHandler._td)("Italy"),
  prefix: "39"
}, {
  iso2: "JM",
  name: (0, _languageHandler._td)("Jamaica"),
  prefix: "1"
}, {
  iso2: "JP",
  name: (0, _languageHandler._td)("Japan"),
  prefix: "81"
}, {
  iso2: "JE",
  name: (0, _languageHandler._td)("Jersey"),
  prefix: "44"
}, {
  iso2: "JO",
  name: (0, _languageHandler._td)("Jordan"),
  prefix: "962"
}, {
  iso2: "KZ",
  name: (0, _languageHandler._td)("Kazakhstan"),
  prefix: "7"
}, {
  iso2: "KE",
  name: (0, _languageHandler._td)("Kenya"),
  prefix: "254"
}, {
  iso2: "KI",
  name: (0, _languageHandler._td)("Kiribati"),
  prefix: "686"
}, {
  iso2: "XK",
  name: (0, _languageHandler._td)("Kosovo"),
  prefix: "383"
}, {
  iso2: "KW",
  name: (0, _languageHandler._td)("Kuwait"),
  prefix: "965"
}, {
  iso2: "KG",
  name: (0, _languageHandler._td)("Kyrgyzstan"),
  prefix: "996"
}, {
  iso2: "LA",
  name: (0, _languageHandler._td)("Laos"),
  prefix: "856"
}, {
  iso2: "LV",
  name: (0, _languageHandler._td)("Latvia"),
  prefix: "371"
}, {
  iso2: "LB",
  name: (0, _languageHandler._td)("Lebanon"),
  prefix: "961"
}, {
  iso2: "LS",
  name: (0, _languageHandler._td)("Lesotho"),
  prefix: "266"
}, {
  iso2: "LR",
  name: (0, _languageHandler._td)("Liberia"),
  prefix: "231"
}, {
  iso2: "LY",
  name: (0, _languageHandler._td)("Libya"),
  prefix: "218"
}, {
  iso2: "LI",
  name: (0, _languageHandler._td)("Liechtenstein"),
  prefix: "423"
}, {
  iso2: "LT",
  name: (0, _languageHandler._td)("Lithuania"),
  prefix: "370"
}, {
  iso2: "LU",
  name: (0, _languageHandler._td)("Luxembourg"),
  prefix: "352"
}, {
  iso2: "MO",
  name: (0, _languageHandler._td)("Macau"),
  prefix: "853"
}, {
  iso2: "MK",
  name: (0, _languageHandler._td)("Macedonia"),
  prefix: "389"
}, {
  iso2: "MG",
  name: (0, _languageHandler._td)("Madagascar"),
  prefix: "261"
}, {
  iso2: "MW",
  name: (0, _languageHandler._td)("Malawi"),
  prefix: "265"
}, {
  iso2: "MY",
  name: (0, _languageHandler._td)("Malaysia"),
  prefix: "60"
}, {
  iso2: "MV",
  name: (0, _languageHandler._td)("Maldives"),
  prefix: "960"
}, {
  iso2: "ML",
  name: (0, _languageHandler._td)("Mali"),
  prefix: "223"
}, {
  iso2: "MT",
  name: (0, _languageHandler._td)("Malta"),
  prefix: "356"
}, {
  iso2: "MH",
  name: (0, _languageHandler._td)("Marshall Islands"),
  prefix: "692"
}, {
  iso2: "MQ",
  name: (0, _languageHandler._td)("Martinique"),
  prefix: "596"
}, {
  iso2: "MR",
  name: (0, _languageHandler._td)("Mauritania"),
  prefix: "222"
}, {
  iso2: "MU",
  name: (0, _languageHandler._td)("Mauritius"),
  prefix: "230"
}, {
  iso2: "YT",
  name: (0, _languageHandler._td)("Mayotte"),
  prefix: "262"
}, {
  iso2: "MX",
  name: (0, _languageHandler._td)("Mexico"),
  prefix: "52"
}, {
  iso2: "FM",
  name: (0, _languageHandler._td)("Micronesia"),
  prefix: "691"
}, {
  iso2: "MD",
  name: (0, _languageHandler._td)("Moldova"),
  prefix: "373"
}, {
  iso2: "MC",
  name: (0, _languageHandler._td)("Monaco"),
  prefix: "377"
}, {
  iso2: "MN",
  name: (0, _languageHandler._td)("Mongolia"),
  prefix: "976"
}, {
  iso2: "ME",
  name: (0, _languageHandler._td)("Montenegro"),
  prefix: "382"
}, {
  iso2: "MS",
  name: (0, _languageHandler._td)("Montserrat"),
  prefix: "1"
}, {
  iso2: "MA",
  name: (0, _languageHandler._td)("Morocco"),
  prefix: "212"
}, {
  iso2: "MZ",
  name: (0, _languageHandler._td)("Mozambique"),
  prefix: "258"
}, {
  iso2: "MM",
  name: (0, _languageHandler._td)("Myanmar"),
  prefix: "95"
}, {
  iso2: "NA",
  name: (0, _languageHandler._td)("Namibia"),
  prefix: "264"
}, {
  iso2: "NR",
  name: (0, _languageHandler._td)("Nauru"),
  prefix: "674"
}, {
  iso2: "NP",
  name: (0, _languageHandler._td)("Nepal"),
  prefix: "977"
}, {
  iso2: "NL",
  name: (0, _languageHandler._td)("Netherlands"),
  prefix: "31"
}, {
  iso2: "NC",
  name: (0, _languageHandler._td)("New Caledonia"),
  prefix: "687"
}, {
  iso2: "NZ",
  name: (0, _languageHandler._td)("New Zealand"),
  prefix: "64"
}, {
  iso2: "NI",
  name: (0, _languageHandler._td)("Nicaragua"),
  prefix: "505"
}, {
  iso2: "NE",
  name: (0, _languageHandler._td)("Niger"),
  prefix: "227"
}, {
  iso2: "NG",
  name: (0, _languageHandler._td)("Nigeria"),
  prefix: "234"
}, {
  iso2: "NU",
  name: (0, _languageHandler._td)("Niue"),
  prefix: "683"
}, {
  iso2: "NF",
  name: (0, _languageHandler._td)("Norfolk Island"),
  prefix: "672"
}, {
  iso2: "KP",
  name: (0, _languageHandler._td)("North Korea"),
  prefix: "850"
}, {
  iso2: "MP",
  name: (0, _languageHandler._td)("Northern Mariana Islands"),
  prefix: "1"
}, {
  iso2: "NO",
  name: (0, _languageHandler._td)("Norway"),
  prefix: "47"
}, {
  iso2: "OM",
  name: (0, _languageHandler._td)("Oman"),
  prefix: "968"
}, {
  iso2: "PK",
  name: (0, _languageHandler._td)("Pakistan"),
  prefix: "92"
}, {
  iso2: "PW",
  name: (0, _languageHandler._td)("Palau"),
  prefix: "680"
}, {
  iso2: "PS",
  name: (0, _languageHandler._td)("Palestine"),
  prefix: "970"
}, {
  iso2: "PA",
  name: (0, _languageHandler._td)("Panama"),
  prefix: "507"
}, {
  iso2: "PG",
  name: (0, _languageHandler._td)("Papua New Guinea"),
  prefix: "675"
}, {
  iso2: "PY",
  name: (0, _languageHandler._td)("Paraguay"),
  prefix: "595"
}, {
  iso2: "PE",
  name: (0, _languageHandler._td)("Peru"),
  prefix: "51"
}, {
  iso2: "PH",
  name: (0, _languageHandler._td)("Philippines"),
  prefix: "63"
}, {
  iso2: "PN",
  name: (0, _languageHandler._td)("Pitcairn Islands"),
  prefix: "870"
}, {
  iso2: "PL",
  name: (0, _languageHandler._td)("Poland"),
  prefix: "48"
}, {
  iso2: "PT",
  name: (0, _languageHandler._td)("Portugal"),
  prefix: "351"
}, {
  iso2: "PR",
  name: (0, _languageHandler._td)("Puerto Rico"),
  prefix: "1"
}, {
  iso2: "QA",
  name: (0, _languageHandler._td)("Qatar"),
  prefix: "974"
}, {
  iso2: "RO",
  name: (0, _languageHandler._td)("Romania"),
  prefix: "40"
}, {
  iso2: "RU",
  name: (0, _languageHandler._td)("Russia"),
  prefix: "7"
}, {
  iso2: "RW",
  name: (0, _languageHandler._td)("Rwanda"),
  prefix: "250"
}, {
  iso2: "RE",
  name: (0, _languageHandler._td)("R\u00e9union"),
  prefix: "262"
}, {
  iso2: "WS",
  name: (0, _languageHandler._td)("Samoa"),
  prefix: "685"
}, {
  iso2: "SM",
  name: (0, _languageHandler._td)("San Marino"),
  prefix: "378"
}, {
  iso2: "SA",
  name: (0, _languageHandler._td)("Saudi Arabia"),
  prefix: "966"
}, {
  iso2: "SN",
  name: (0, _languageHandler._td)("Senegal"),
  prefix: "221"
}, {
  iso2: "RS",
  name: (0, _languageHandler._td)("Serbia"),
  prefix: "381 p"
}, {
  iso2: "SC",
  name: (0, _languageHandler._td)("Seychelles"),
  prefix: "248"
}, {
  iso2: "SL",
  name: (0, _languageHandler._td)("Sierra Leone"),
  prefix: "232"
}, {
  iso2: "SG",
  name: (0, _languageHandler._td)("Singapore"),
  prefix: "65"
}, {
  iso2: "SX",
  name: (0, _languageHandler._td)("Sint Maarten"),
  prefix: "1"
}, {
  iso2: "SK",
  name: (0, _languageHandler._td)("Slovakia"),
  prefix: "421"
}, {
  iso2: "SI",
  name: (0, _languageHandler._td)("Slovenia"),
  prefix: "386"
}, {
  iso2: "SB",
  name: (0, _languageHandler._td)("Solomon Islands"),
  prefix: "677"
}, {
  iso2: "SO",
  name: (0, _languageHandler._td)("Somalia"),
  prefix: "252"
}, {
  iso2: "ZA",
  name: (0, _languageHandler._td)("South Africa"),
  prefix: "27"
}, {
  iso2: "GS",
  name: (0, _languageHandler._td)("South Georgia & South Sandwich Islands"),
  prefix: "500"
}, {
  iso2: "KR",
  name: (0, _languageHandler._td)("South Korea"),
  prefix: "82"
}, {
  iso2: "SS",
  name: (0, _languageHandler._td)("South Sudan"),
  prefix: "211"
}, {
  iso2: "ES",
  name: (0, _languageHandler._td)("Spain"),
  prefix: "34"
}, {
  iso2: "LK",
  name: (0, _languageHandler._td)("Sri Lanka"),
  prefix: "94"
}, {
  iso2: "BL",
  name: (0, _languageHandler._td)("St. Barth\u00e9lemy"),
  prefix: "590"
}, {
  iso2: "SH",
  name: (0, _languageHandler._td)("St. Helena"),
  prefix: "290 n"
}, {
  iso2: "KN",
  name: (0, _languageHandler._td)("St. Kitts & Nevis"),
  prefix: "1"
}, {
  iso2: "LC",
  name: (0, _languageHandler._td)("St. Lucia"),
  prefix: "1"
}, {
  iso2: "MF",
  name: (0, _languageHandler._td)("St. Martin"),
  prefix: "590"
}, {
  iso2: "PM",
  name: (0, _languageHandler._td)("St. Pierre & Miquelon"),
  prefix: "508"
}, {
  iso2: "VC",
  name: (0, _languageHandler._td)("St. Vincent & Grenadines"),
  prefix: "1"
}, {
  iso2: "SD",
  name: (0, _languageHandler._td)("Sudan"),
  prefix: "249"
}, {
  iso2: "SR",
  name: (0, _languageHandler._td)("Suriname"),
  prefix: "597"
}, {
  iso2: "SJ",
  name: (0, _languageHandler._td)("Svalbard & Jan Mayen"),
  prefix: "47"
}, {
  iso2: "SZ",
  name: (0, _languageHandler._td)("Swaziland"),
  prefix: "268"
}, {
  iso2: "SE",
  name: (0, _languageHandler._td)("Sweden"),
  prefix: "46"
}, {
  iso2: "CH",
  name: (0, _languageHandler._td)("Switzerland"),
  prefix: "41"
}, {
  iso2: "SY",
  name: (0, _languageHandler._td)("Syria"),
  prefix: "963"
}, {
  iso2: "ST",
  name: (0, _languageHandler._td)("S\u00e3o Tom\u00e9 & Pr\u00edncipe"),
  prefix: "239"
}, {
  iso2: "TW",
  name: (0, _languageHandler._td)("Taiwan"),
  prefix: "886"
}, {
  iso2: "TJ",
  name: (0, _languageHandler._td)("Tajikistan"),
  prefix: "992"
}, {
  iso2: "TZ",
  name: (0, _languageHandler._td)("Tanzania"),
  prefix: "255"
}, {
  iso2: "TH",
  name: (0, _languageHandler._td)("Thailand"),
  prefix: "66"
}, {
  iso2: "TL",
  name: (0, _languageHandler._td)("Timor-Leste"),
  prefix: "670"
}, {
  iso2: "TG",
  name: (0, _languageHandler._td)("Togo"),
  prefix: "228"
}, {
  iso2: "TK",
  name: (0, _languageHandler._td)("Tokelau"),
  prefix: "690"
}, {
  iso2: "TO",
  name: (0, _languageHandler._td)("Tonga"),
  prefix: "676"
}, {
  iso2: "TT",
  name: (0, _languageHandler._td)("Trinidad & Tobago"),
  prefix: "1"
}, {
  iso2: "TN",
  name: (0, _languageHandler._td)("Tunisia"),
  prefix: "216"
}, {
  iso2: "TR",
  name: (0, _languageHandler._td)("Turkey"),
  prefix: "90"
}, {
  iso2: "TM",
  name: (0, _languageHandler._td)("Turkmenistan"),
  prefix: "993"
}, {
  iso2: "TC",
  name: (0, _languageHandler._td)("Turks & Caicos Islands"),
  prefix: "1"
}, {
  iso2: "TV",
  name: (0, _languageHandler._td)("Tuvalu"),
  prefix: "688"
}, {
  iso2: "VI",
  name: (0, _languageHandler._td)("U.S. Virgin Islands"),
  prefix: "1"
}, {
  iso2: "UG",
  name: (0, _languageHandler._td)("Uganda"),
  prefix: "256"
}, {
  iso2: "UA",
  name: (0, _languageHandler._td)("Ukraine"),
  prefix: "380"
}, {
  iso2: "AE",
  name: (0, _languageHandler._td)("United Arab Emirates"),
  prefix: "971"
}, {
  iso2: "UY",
  name: (0, _languageHandler._td)("Uruguay"),
  prefix: "598"
}, {
  iso2: "UZ",
  name: (0, _languageHandler._td)("Uzbekistan"),
  prefix: "998"
}, {
  iso2: "VU",
  name: (0, _languageHandler._td)("Vanuatu"),
  prefix: "678"
}, {
  iso2: "VA",
  name: (0, _languageHandler._td)("Vatican City"),
  prefix: "39"
}, {
  iso2: "VE",
  name: (0, _languageHandler._td)("Venezuela"),
  prefix: "58"
}, {
  iso2: "VN",
  name: (0, _languageHandler._td)("Vietnam"),
  prefix: "84"
}, {
  iso2: "WF",
  name: (0, _languageHandler._td)("Wallis & Futuna"),
  prefix: "681"
}, {
  iso2: "EH",
  name: (0, _languageHandler._td)("Western Sahara"),
  prefix: "212"
}, {
  iso2: "YE",
  name: (0, _languageHandler._td)("Yemen"),
  prefix: "967"
}, {
  iso2: "ZM",
  name: (0, _languageHandler._td)("Zambia"),
  prefix: "260"
}, {
  iso2: "ZW",
  name: (0, _languageHandler._td)("Zimbabwe"),
  prefix: "263"
}];
exports.COUNTRIES = COUNTRIES;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbGFuZ3VhZ2VIYW5kbGVyIiwicmVxdWlyZSIsIlBIT05FX05VTUJFUl9SRUdFWFAiLCJsb29rc1ZhbGlkIiwicGhvbmVOdW1iZXIiLCJ0ZXN0IiwiVU5JQ09ERV9CQVNFIiwiY2hhckNvZGVBdCIsIkNPVU5UUllfQ09ERV9SRUdFWCIsImdldEVtb2ppRmxhZyIsImNvdW50cnlDb2RlIiwiU3RyaW5nIiwiZnJvbUNvZGVQb2ludCIsInNwbGl0IiwibWFwIiwibCIsImV4cG9ydHMiLCJDT1VOVFJJRVMiLCJpc28yIiwibmFtZSIsIl90ZCIsInByZWZpeCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9waG9uZW51bWJlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTcgVmVjdG9yIENyZWF0aW9ucyBMdGRcblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBfdGQgfSBmcm9tIFwiLi9sYW5ndWFnZUhhbmRsZXJcIjtcblxuY29uc3QgUEhPTkVfTlVNQkVSX1JFR0VYUCA9IC9eWzAtOSAtLl0rJC87XG5cbi8qXG4gKiBEbyBiYXNpYyB2YWxpZGF0aW9uIHRvIGRldGVybWluZSBpZiB0aGUgZ2l2ZW4gaW5wdXQgY291bGQgYmVcbiAqIGEgdmFsaWQgcGhvbmUgbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwaG9uZU51bWJlciBUaGUgc3RyaW5nIHRvIHZhbGlkYXRlLiBUaGlzIGNvdWxkIGJlXG4gKiAgICAgZWl0aGVyIGFuIGludGVybmF0aW9uYWwgZm9ybWF0IG51bWJlciAoTVNJU0ROIG9yIGUuMTY0KSBvclxuICogICAgIGEgbmF0aW9uYWwtZm9ybWF0IG51bWJlci5cbiAqIEByZXR1cm4gVHJ1ZSBpZiB0aGUgbnVtYmVyIGNvdWxkIGJlIGEgdmFsaWQgcGhvbmUgbnVtYmVyLCBvdGhlcndpc2UgZmFsc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb29rc1ZhbGlkKHBob25lTnVtYmVyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gUEhPTkVfTlVNQkVSX1JFR0VYUC50ZXN0KHBob25lTnVtYmVyKTtcbn1cblxuLy8gUmVnaW9uYWwgSW5kaWNhdG9yIFN5bWJvbCBMZXR0ZXIgQVxuY29uc3QgVU5JQ09ERV9CQVNFID0gMTI3NDYyIC0gXCJBXCIuY2hhckNvZGVBdCgwKTtcbi8vIENvdW50cnkgY29kZSBzaG91bGQgYmUgZXhhY3RseSAyIHVwcGVyY2FzZSBjaGFyYWN0ZXJzXG5jb25zdCBDT1VOVFJZX0NPREVfUkVHRVggPSAvXltBLVpdezJ9JC87XG5cbmV4cG9ydCBjb25zdCBnZXRFbW9qaUZsYWcgPSAoY291bnRyeUNvZGU6IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gICAgaWYgKCFDT1VOVFJZX0NPREVfUkVHRVgudGVzdChjb3VudHJ5Q29kZSkpIHJldHVybiBcIlwiO1xuICAgIC8vIFJpcCB0aGUgY291bnRyeSBjb2RlIG91dCBvZiB0aGUgZW1vamkgYW5kIHVzZSB0aGF0XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KC4uLmNvdW50cnlDb2RlLnNwbGl0KFwiXCIpLm1hcCgobCkgPT4gVU5JQ09ERV9CQVNFICsgbC5jaGFyQ29kZUF0KDApKSk7XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFBob25lTnVtYmVyQ291bnRyeURlZmluaXRpb24ge1xuICAgIGlzbzI6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgcHJlZml4OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBDT1VOVFJJRVM6IFBob25lTnVtYmVyQ291bnRyeURlZmluaXRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR0JcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVW5pdGVkIEtpbmdkb21cIiksXG4gICAgICAgIHByZWZpeDogXCI0NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlVTXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlVuaXRlZCBTdGF0ZXNcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQUZcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQWZnaGFuaXN0YW5cIiksXG4gICAgICAgIHByZWZpeDogXCI5M1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkFYXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlxcdTAwYzVsYW5kIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCIzNThcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBTFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBbGJhbmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzU1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRFpcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQWxnZXJpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIxM1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkFTXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkFtZXJpY2FuIFNhbW9hXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkFEXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkFuZG9ycmFcIiksXG4gICAgICAgIHByZWZpeDogXCIzNzZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBT1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBbmdvbGFcIiksXG4gICAgICAgIHByZWZpeDogXCIyNDRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBSVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBbmd1aWxsYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBUVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBbnRhcmN0aWNhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjcyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQUdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQW50aWd1YSAmIEJhcmJ1ZGFcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQVJcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQXJnZW50aW5hXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBcm1lbmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzc0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQVdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQXJ1YmFcIiksXG4gICAgICAgIHByZWZpeDogXCIyOTdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBVVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJBdXN0cmFsaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI2MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkFUXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkF1c3RyaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI0M1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkFaXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkF6ZXJiYWlqYW5cIiksXG4gICAgICAgIHByZWZpeDogXCI5OTRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCYWhhbWFzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkJIXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJhaHJhaW5cIiksXG4gICAgICAgIHByZWZpeDogXCI5NzNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCRFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCYW5nbGFkZXNoXCIpLFxuICAgICAgICBwcmVmaXg6IFwiODgwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQkJcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQmFyYmFkb3NcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQllcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQmVsYXJ1c1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjM3NVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkJFXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJlbGdpdW1cIiksXG4gICAgICAgIHByZWZpeDogXCIzMlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkJaXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJlbGl6ZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjUwMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkJKXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJlbmluXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjI5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQk1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiQmVybXVkYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCVFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCaHV0YW5cIiksXG4gICAgICAgIHByZWZpeDogXCI5NzVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCT1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCb2xpdmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTkxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQkFcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQm9zbmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzg3XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQldcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQm90c3dhbmFcIiksXG4gICAgICAgIHByZWZpeDogXCIyNjdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCVlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCb3V2ZXQgSXNsYW5kXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCcmF6aWxcIiksXG4gICAgICAgIHByZWZpeDogXCI1NVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIklPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJyaXRpc2ggSW5kaWFuIE9jZWFuIFRlcnJpdG9yeVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI0NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlZHXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkJyaXRpc2ggVmlyZ2luIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQk5cIixcbiAgICAgICAgbmFtZTogX3RkKFwiQnJ1bmVpXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjczXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQkdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQnVsZ2FyaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIzNTlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCRlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCdXJraW5hIEZhc29cIiksXG4gICAgICAgIHByZWZpeDogXCIyMjZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJCSVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJCdXJ1bmRpXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjU3XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS0hcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2FtYm9kaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI4NTVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDYW1lcm9vblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIzN1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNBXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkNhbmFkYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDVlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDYXBlIFZlcmRlXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjM4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQlFcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2FyaWJiZWFuIE5ldGhlcmxhbmRzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTk5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS1lcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2F5bWFuIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQ0ZcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2VudHJhbCBBZnJpY2FuIFJlcHVibGljXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjM2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVERcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2hhZFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIzNVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNMXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkNoaWxlXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDTlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDaGluYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjg2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQ1hcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ2hyaXN0bWFzIElzbGFuZFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjYxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQ0NcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ29jb3MgKEtlZWxpbmcpIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCI2MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkNvbG9tYmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJLTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDb21vcm9zXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjY5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiQ0dcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ29uZ28gLSBCcmF6emF2aWxsZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI0MlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNEXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkNvbmdvIC0gS2luc2hhc2FcIiksXG4gICAgICAgIHByZWZpeDogXCIyNDNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDS1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDb29rIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDb3N0YSBSaWNhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTA2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSFJcIixcbiAgICAgICAgbmFtZTogX3RkKFwiQ3JvYXRpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM4NVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNVXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkN1YmFcIiksXG4gICAgICAgIHByZWZpeDogXCI1M1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNXXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkN1cmFcXHUwMGU3YW9cIiksXG4gICAgICAgIHByZWZpeDogXCI1OTlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDWVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDeXBydXNcIiksXG4gICAgICAgIHByZWZpeDogXCIzNTdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJDWlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJDemVjaCBSZXB1YmxpY1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjQyMFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNJXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkNcXHUwMGY0dGUgZFxcdTIwMTlJdm9pcmVcIiksXG4gICAgICAgIHByZWZpeDogXCIyMjVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJES1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJEZW5tYXJrXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJESlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJEamlib3V0aVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI1M1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkRNXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkRvbWluaWNhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkRPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkRvbWluaWNhbiBSZXB1YmxpY1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJFQ1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJFY3VhZG9yXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTkzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRUdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRWd5cHRcIiksXG4gICAgICAgIHByZWZpeDogXCIyMFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNWXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkVsIFNhbHZhZG9yXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTAzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR1FcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRXF1YXRvcmlhbCBHdWluZWFcIiksXG4gICAgICAgIHByZWZpeDogXCIyNDBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJFUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJFcml0cmVhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjkxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRUVcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRXN0b25pYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM3MlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkVUXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkV0aGlvcGlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjUxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRktcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRmFsa2xhbmQgSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjUwMFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkZPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkZhcm9lIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCIyOThcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJGSlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJGaWppXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjc5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRklcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRmlubGFuZFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM1OFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkZSXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkZyYW5jZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjMzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR0ZcIixcbiAgICAgICAgbmFtZTogX3RkKFwiRnJlbmNoIEd1aWFuYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjU5NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlBGXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkZyZW5jaCBQb2x5bmVzaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJURlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJGcmVuY2ggU291dGhlcm4gVGVycml0b3JpZXNcIiksXG4gICAgICAgIHByZWZpeDogXCIyNjJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHQVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHYWJvblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI0MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkdNXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkdhbWJpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIyMFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkdFXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkdlb3JnaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI5OTVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJERVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHZXJtYW55XCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHSFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHaGFuYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIzM1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkdJXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkdpYnJhbHRhclwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM1MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkdSXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkdyZWVjZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjMwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR0xcIixcbiAgICAgICAgbmFtZTogX3RkKFwiR3JlZW5sYW5kXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjk5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR0RcIixcbiAgICAgICAgbmFtZTogX3RkKFwiR3JlbmFkYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHUFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHdWFkZWxvdXBlXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTkwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR1VcIixcbiAgICAgICAgbmFtZTogX3RkKFwiR3VhbVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHVFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHdWF0ZW1hbGFcIiksXG4gICAgICAgIHByZWZpeDogXCI1MDJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHR1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJHdWVybnNleVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjQ0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR05cIixcbiAgICAgICAgbmFtZTogX3RkKFwiR3VpbmVhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjI0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiR1dcIixcbiAgICAgICAgbmFtZTogX3RkKFwiR3VpbmVhLUJpc3NhdVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI0NVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkdZXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkd1eWFuYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjU5MlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkhUXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkhhaXRpXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTA5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSE1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiSGVhcmQgJiBNY0RvbmFsZCBJc2xhbmRzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjcyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSE5cIixcbiAgICAgICAgbmFtZTogX3RkKFwiSG9uZHVyYXNcIiksXG4gICAgICAgIHByZWZpeDogXCI1MDRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJIS1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJIb25nIEtvbmdcIiksXG4gICAgICAgIHByZWZpeDogXCI4NTJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJIVVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJIdW5nYXJ5XCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJJU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJJY2VsYW5kXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzU0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSU5cIixcbiAgICAgICAgbmFtZTogX3RkKFwiSW5kaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI5MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIklEXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkluZG9uZXNpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjYyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSVJcIixcbiAgICAgICAgbmFtZTogX3RkKFwiSXJhblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSVFcIixcbiAgICAgICAgbmFtZTogX3RkKFwiSXJhcVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk2NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIklFXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIklyZWxhbmRcIiksXG4gICAgICAgIHByZWZpeDogXCIzNTNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJJTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJJc2xlIG9mIE1hblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjQ0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSUxcIixcbiAgICAgICAgbmFtZTogX3RkKFwiSXNyYWVsXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTcyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSVRcIixcbiAgICAgICAgbmFtZTogX3RkKFwiSXRhbHlcIiksXG4gICAgICAgIHByZWZpeDogXCIzOVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkpNXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkphbWFpY2FcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSlBcIixcbiAgICAgICAgbmFtZTogX3RkKFwiSmFwYW5cIiksXG4gICAgICAgIHByZWZpeDogXCI4MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkpFXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkplcnNleVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjQ0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiSk9cIixcbiAgICAgICAgbmFtZTogX3RkKFwiSm9yZGFuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTYyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS1pcIixcbiAgICAgICAgbmFtZTogX3RkKFwiS2F6YWtoc3RhblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJLRVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJLZW55YVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI1NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIktJXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIktpcmliYXRpXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjg2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiWEtcIixcbiAgICAgICAgbmFtZTogX3RkKFwiS29zb3ZvXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzgzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS1dcIixcbiAgICAgICAgbmFtZTogX3RkKFwiS3V3YWl0XCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTY1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS0dcIixcbiAgICAgICAgbmFtZTogX3RkKFwiS3lyZ3l6c3RhblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk5NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkxBXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkxhb3NcIiksXG4gICAgICAgIHByZWZpeDogXCI4NTZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMVlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJMYXR2aWFcIiksXG4gICAgICAgIHByZWZpeDogXCIzNzFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMQlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJMZWJhbm9uXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTYxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTFNcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTGVzb3Rob1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjI2NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkxSXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkxpYmVyaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIyMzFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMWVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJMaWJ5YVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIxOFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkxJXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIkxpZWNodGVuc3RlaW5cIiksXG4gICAgICAgIHByZWZpeDogXCI0MjNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMVFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJMaXRodWFuaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIzNzBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMVVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJMdXhlbWJvdXJnXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzUyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTU9cIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWFjYXVcIiksXG4gICAgICAgIHByZWZpeDogXCI4NTNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNS1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNYWNlZG9uaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIzODlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNR1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNYWRhZ2FzY2FyXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjYxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTVdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWFsYXdpXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjY1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTVlcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWFsYXlzaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI2MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1WXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1hbGRpdmVzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTYwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTUxcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWFsaVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIyM1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1UXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1hbHRhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzU2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTUhcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWFyc2hhbGwgSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjY5MlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1RXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1hcnRpbmlxdWVcIiksXG4gICAgICAgIHByZWZpeDogXCI1OTZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNYXVyaXRhbmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjIyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTVVcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWF1cml0aXVzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjMwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiWVRcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWF5b3R0ZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI2MlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1YXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1leGljb1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjUyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiRk1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiTWljcm9uZXNpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY5MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1EXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1vbGRvdmFcIiksXG4gICAgICAgIHByZWZpeDogXCIzNzNcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNQ1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNb25hY29cIiksXG4gICAgICAgIHByZWZpeDogXCIzNzdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNTlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNb25nb2xpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk3NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1FXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1vbnRlbmVncm9cIiksXG4gICAgICAgIHByZWZpeDogXCIzODJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNb250c2VycmF0XCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1BXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk1vcm9jY29cIiksXG4gICAgICAgIHByZWZpeDogXCIyMTJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJNWlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJNb3phbWJpcXVlXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjU4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTU1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiTXlhbm1hclwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTkFcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTmFtaWJpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI2NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk5SXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk5hdXJ1XCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjc0XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTlBcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTmVwYWxcIiksXG4gICAgICAgIHByZWZpeDogXCI5NzdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJOTFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOZXRoZXJsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjMxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTkNcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTmV3IENhbGVkb25pYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY4N1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk5aXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk5ldyBaZWFsYW5kXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJOSVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOaWNhcmFndWFcIiksXG4gICAgICAgIHByZWZpeDogXCI1MDVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJORVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOaWdlclwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIyN1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk5HXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk5pZ2VyaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIyMzRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJOVVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOaXVlXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjgzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTkZcIixcbiAgICAgICAgbmFtZTogX3RkKFwiTm9yZm9sayBJc2xhbmRcIiksXG4gICAgICAgIHByZWZpeDogXCI2NzJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJLUFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOb3J0aCBLb3JlYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjg1MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1QXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk5vcnRoZXJuIE1hcmlhbmEgSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJOT1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJOb3J3YXlcIiksXG4gICAgICAgIHByZWZpeDogXCI0N1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk9NXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIk9tYW5cIiksXG4gICAgICAgIHByZWZpeDogXCI5NjhcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQS1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQYWtpc3RhblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjkyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiUFdcIixcbiAgICAgICAgbmFtZTogX3RkKFwiUGFsYXVcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQYWxlc3RpbmVcIiksXG4gICAgICAgIHByZWZpeDogXCI5NzBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQQVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQYW5hbWFcIiksXG4gICAgICAgIHByZWZpeDogXCI1MDdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQR1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQYXB1YSBOZXcgR3VpbmVhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjc1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiUFlcIixcbiAgICAgICAgbmFtZTogX3RkKFwiUGFyYWd1YXlcIiksXG4gICAgICAgIHByZWZpeDogXCI1OTVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQRVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQZXJ1XCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQSFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQaGlsaXBwaW5lc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjYzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiUE5cIixcbiAgICAgICAgbmFtZTogX3RkKFwiUGl0Y2Fpcm4gSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjg3MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlBMXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlBvbGFuZFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjQ4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiUFRcIixcbiAgICAgICAgbmFtZTogX3RkKFwiUG9ydHVnYWxcIiksXG4gICAgICAgIHByZWZpeDogXCIzNTFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJQdWVydG8gUmljb1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJRQVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJRYXRhclwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk3NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlJPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlJvbWFuaWFcIiksXG4gICAgICAgIHByZWZpeDogXCI0MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlJVXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlJ1c3NpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJSV1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJSd2FuZGFcIiksXG4gICAgICAgIHByZWZpeDogXCIyNTBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJSRVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJSXFx1MDBlOXVuaW9uXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjYyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiV1NcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2Ftb2FcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTYW4gTWFyaW5vXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzc4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU0FcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2F1ZGkgQXJhYmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTY2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU05cIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2VuZWdhbFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIyMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlJTXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNlcmJpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM4MSBwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU0NcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2V5Y2hlbGxlc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjI0OFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNMXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNpZXJyYSBMZW9uZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIzMlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNHXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNpbmdhcG9yZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY1XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU1hcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2ludCBNYWFydGVuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNLXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNsb3Zha2lhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU0lcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU2xvdmVuaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIzODZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTQlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTb2xvbW9uIElzbGFuZHNcIiksXG4gICAgICAgIHByZWZpeDogXCI2NzdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTT1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTb21hbGlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjUyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiWkFcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU291dGggQWZyaWNhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJHU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTb3V0aCBHZW9yZ2lhICYgU291dGggU2FuZHdpY2ggSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjUwMFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIktSXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNvdXRoIEtvcmVhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiODJcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTU1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTb3V0aCBTdWRhblwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIxMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkVTXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNwYWluXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMzRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJMS1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTcmkgTGFua2FcIiksXG4gICAgICAgIHByZWZpeDogXCI5NFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkJMXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlN0LiBCYXJ0aFxcdTAwZTlsZW15XCIpLFxuICAgICAgICBwcmVmaXg6IFwiNTkwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU0hcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU3QuIEhlbGVuYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI5MCBuXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiS05cIixcbiAgICAgICAgbmFtZTogX3RkKFwiU3QuIEtpdHRzICYgTmV2aXNcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiTENcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU3QuIEx1Y2lhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIk1GXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlN0LiBNYXJ0aW5cIiksXG4gICAgICAgIHByZWZpeDogXCI1OTBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJQTVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTdC4gUGllcnJlICYgTWlxdWVsb25cIiksXG4gICAgICAgIHByZWZpeDogXCI1MDhcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJWQ1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTdC4gVmluY2VudCAmIEdyZW5hZGluZXNcIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiU0RcIixcbiAgICAgICAgbmFtZTogX3RkKFwiU3VkYW5cIiksXG4gICAgICAgIHByZWZpeDogXCIyNDlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTUlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTdXJpbmFtZVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjU5N1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNKXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlN2YWxiYXJkICYgSmFuIE1heWVuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDdcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTWlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTd2F6aWxhbmRcIiksXG4gICAgICAgIHByZWZpeDogXCIyNjhcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTRVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTd2VkZW5cIiksXG4gICAgICAgIHByZWZpeDogXCI0NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIkNIXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlN3aXR6ZXJsYW5kXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNDFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJTWVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJTeXJpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjk2M1wiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlNUXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlNcXHUwMGUzbyBUb21cXHUwMGU5ICYgUHJcXHUwMGVkbmNpcGVcIiksXG4gICAgICAgIHByZWZpeDogXCIyMzlcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJUV1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJUYWl3YW5cIiksXG4gICAgICAgIHByZWZpeDogXCI4ODZcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJUSlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJUYWppa2lzdGFuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTkyXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVFpcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVGFuemFuaWFcIiksXG4gICAgICAgIHByZWZpeDogXCIyNTVcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJUSFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJUaGFpbGFuZFwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVExcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVGltb3ItTGVzdGVcIiksXG4gICAgICAgIHByZWZpeDogXCI2NzBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJUR1wiLFxuICAgICAgICBuYW1lOiBfdGQoXCJUb2dvXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjI4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVEtcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVG9rZWxhdVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY5MFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlRPXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlRvbmdhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNjc2XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVFRcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVHJpbmlkYWQgJiBUb2JhZ29cIiksXG4gICAgICAgIHByZWZpeDogXCIxXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVE5cIixcbiAgICAgICAgbmFtZTogX3RkKFwiVHVuaXNpYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIxNlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlRSXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlR1cmtleVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjkwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVE1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiVHVya21lbmlzdGFuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTkzXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVENcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVHVya3MgJiBDYWljb3MgSXNsYW5kc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJUVlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJUdXZhbHVcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODhcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJWSVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJVLlMuIFZpcmdpbiBJc2xhbmRzXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlVHXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlVnYW5kYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjI1NlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlVBXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlVrcmFpbmVcIiksXG4gICAgICAgIHByZWZpeDogXCIzODBcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJBRVwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJVbml0ZWQgQXJhYiBFbWlyYXRlc1wiKSxcbiAgICAgICAgcHJlZml4OiBcIjk3MVwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlVZXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlVydWd1YXlcIiksXG4gICAgICAgIHByZWZpeDogXCI1OThcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJVWlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJVemJla2lzdGFuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTk4XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVlVcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVmFudWF0dVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjY3OFwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIlZBXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlZhdGljYW4gQ2l0eVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjM5XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiVkVcIixcbiAgICAgICAgbmFtZTogX3RkKFwiVmVuZXp1ZWxhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiNThcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJWTlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJWaWV0bmFtXCIpLFxuICAgICAgICBwcmVmaXg6IFwiODRcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJXRlwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJXYWxsaXMgJiBGdXR1bmFcIiksXG4gICAgICAgIHByZWZpeDogXCI2ODFcIixcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaXNvMjogXCJFSFwiLFxuICAgICAgICBuYW1lOiBfdGQoXCJXZXN0ZXJuIFNhaGFyYVwiKSxcbiAgICAgICAgcHJlZml4OiBcIjIxMlwiLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpc28yOiBcIllFXCIsXG4gICAgICAgIG5hbWU6IF90ZChcIlllbWVuXCIpLFxuICAgICAgICBwcmVmaXg6IFwiOTY3XCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiWk1cIixcbiAgICAgICAgbmFtZTogX3RkKFwiWmFtYmlhXCIpLFxuICAgICAgICBwcmVmaXg6IFwiMjYwXCIsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlzbzI6IFwiWldcIixcbiAgICAgICAgbmFtZTogX3RkKFwiWmltYmFid2VcIiksXG4gICAgICAgIHByZWZpeDogXCIyNjNcIixcbiAgICB9LFxuXTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQWdCQSxJQUFBQSxnQkFBQSxHQUFBQyxPQUFBO0FBaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFJQSxNQUFNQyxtQkFB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QUN0QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFdBQVcsQ0FBQztFQUN0QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFB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QUFFLElBQUFDLG9CQUFHLEVBQUMsV0FBVyxDQUFDO0VBQ3RCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsV0FBVyxDQUFDO0VBQ3RCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsWUFBWSxDQUFDO0VBQ3ZCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsTUFBTSxDQUFDO0VBQ2pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsV0FBVyxDQUFDO0VBQ3RCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsVUFBVSxDQUFDO0VBQ3JCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsZUFBZSxDQUFDO0VBQzFCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsT0FBTyxDQUFDO0VBQ2xCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsMEJBQTBCLENBQUM7RUFDckNDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxVQUFVLENBQUM7RUFDckJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxNQUFNLENBQUM7RUFDakJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxNQUFNLENBQUM7RUFDakJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxhQUFhLENBQUM7RUFDeEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxZQUFZLENBQUM7RUFDdkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxVQUFVLENBQUM7RUFDckJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxZQUFZLENBQUM7RUFDdkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxNQUFNLENBQUM7RUFDakJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxlQUFlLENBQUM7RUFDMUJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxZQUFZLENBQUM7RUFDdkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxZQUFZLENBQUM7RUFDdkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxVQUFVLENBQUM7RUFDckJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxVQUFVLENBQUM7RUFDckJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxNQUFNLENBQUM7RUFDakJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxrQkFBa0IsQ0FBQztFQUM3QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFdBQVcsQ0FBQztFQUN0QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGFBQWEsQ0FBQztFQUN4QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGVBQWUsQ0FBQztFQUMxQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGFBQWEsQ0FBQztFQUN4QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFdBQVcsQ0FBQztFQUN0QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElB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Q0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsT0FBTyxDQUFDO0VBQ2xCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsT0FBTyxDQUFDO0VBQ2xCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsWUFBWSxDQUFDO0VBQ3ZCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsWUFBWSxDQUFDO0VBQ3ZCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsV0FBVyxDQUFDO0VBQ3RCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsVUFBVSxDQUFDO0VBQ3JCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsVUFBVSxDQUFDO0VBQ3JCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsaUJBQWlCLENBQUM7RUFDNUJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxTQUFTLENBQUM7RUFDcEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxjQUFjLENBQUM7RUFDekJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyx3Q0FBd0MsQ0FBQztFQUNuREMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGFBQWEsQ0FBQztFQUN4QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGFBQWEsQ0FBQztFQUN4QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFdBQVcsQ0FBQztFQUN0QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLHFCQUFxQixDQUFDO0VBQ2hDQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsWUFBWSxDQUFDO0VBQ3ZCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsbUJBQW1CLENBQUM7RUFDOUJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxZQUFZLENBQUM7RUFDdkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyx1QkFBdUIsQ0FBQztFQUNsQ0MsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLDBCQUEwQixDQUFDO0VBQ3JDQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsT0FBTyxDQUFDO0VBQ2xCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsVUFBVSxDQUFDO0VBQ3JCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsc0JBQXNCLENBQUM7RUFDakNDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxXQUFXLENBQUM7RUFDdEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxhQUFhLENBQUM7RUFDeEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxPQUFPLENBQUM7RUFDbEJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxvQ0FBb0MsQ0FBQztFQUMvQ0MsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFlBQVksQ0FBQztFQUN2QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLGFBQWEsQ0FBQztFQUN4QkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE1BQU0sQ0FBQztFQUNqQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLG1CQUFtQixDQUFDO0VBQzlCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsUUFBUSxDQUFDO0VBQ25CQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsd0JBQXdCLENBQUM7RUFDbkNDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxRQUFRLENBQUM7RUFDbkJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxxQkFBcUIsQ0FBQztFQUNoQ0MsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFNBQVMsQ0FBQztFQUNwQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLHNCQUFzQixDQUFDO0VBQ2pDQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsWUFBWSxDQUFDO0VBQ3ZCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsY0FBYyxDQUFDO0VBQ3pCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsV0FBVyxDQUFDO0VBQ3RCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsU0FBUyxDQUFDO0VBQ3BCQyxNQUFNLEVBQUU7QUFDWixDQUFDLEVBQ0Q7RUFDSUgsSUFBSSxFQUFFLElBQUk7RUFDVkMsSUFBSSxFQUFFLElBQUFDLG9CQUFHLEVBQUMsaUJBQWlCLENBQUM7RUFDNUJDLE1BQU0sRUFBRTtBQUNaLENBQUMsRUFDRDtFQUNJSCxJQUFJLEVBQUUsSUFBSTtFQUNWQyxJQUFJLEVBQUUsSUFBQUMsb0JBQUcsRUFBQyxnQkFBZ0IsQ0FBQztFQUMzQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLE9BQU8sQ0FBQztFQUNsQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFFBQVEsQ0FBQztFQUNuQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxFQUNEO0VBQ0lILElBQUksRUFBRSxJQUFJO0VBQ1ZDLElBQUksRUFBRSxJQUFBQyxvQkFBRyxFQUFDLFVBQVUsQ0FBQztFQUNyQkMsTUFBTSxFQUFFO0FBQ1osQ0FBQyxDQUNKO0FBQUNMLE9BQUEsQ0FBQUMsU0FBQSxHQUFBQSxTQUFBIn0=