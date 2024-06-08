import React, { useState, useRef } from "react";
import useOutsideClick from "./useOutsideClick";
function CustomSelect({ options, onChange, destinationPre }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const ref = useRef();
    const handleOptionClick = (option) => {
        setSelectedOption(option);
        setIsOpen(false);
        onChange(option);
    };

    useOutsideClick(ref, () => {
        if (isOpen) {
            setIsOpen(false);
        }
    });
    return (
        <div ref={ref} className="custom-select" id="recieverAddresses" onClick={() => setIsOpen(!isOpen)}>
            <div className="selected-option">{destinationPre || "Select an address"}</div>
            {isOpen && (
                <div className="options">
                    {options.map((option) => (
                        <div key={option} className="option-my" onClick={() => handleOptionClick(option.wallet)}>
                            <div>{option.wallet}</div>
                            <div style={{ fontSize: "10px", fontStyle: "italic" }}>@{option.displayName}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CustomSelect;
