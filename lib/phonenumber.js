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
//# sourceMappingURL=phonenumber.js.map