"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _react = require("react");
function useOutsideClick(ref, callback) {
  const handleClick = event => {
    if (ref.current && !ref.current.contains(event.target)) {
      callback();
    }
  };
  (0, _react.useEffect)(() => {
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [ref, callback]);
}
var _default = useOutsideClick;
exports.default = _default;
//# sourceMappingURL=useOutsideClick.js.map