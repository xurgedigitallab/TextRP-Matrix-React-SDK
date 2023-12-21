import React, { useEffect, useState } from "react";
import axios from "axios";
import SdkConfig from "../../SdkConfig";
export default function Env() {
    const [env, setEnv] = useState("");
    useEffect(() => {
        const getEnv = async () => {
            let res = await axios.get(`${SdkConfig.get().backend_url}/get-all-env`);
            setEnv(res.data[0].value);
        };
        getEnv();
    }, []);
    return (
        <div
            style={{
                backgroundColor: "white",
                height: "40px",
                width: "150px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "fixed",
                bottom: "20px",
                right: "20px",
                fontWeight: 'bold',
                color: "purple",
                borderRadius:"15px",
                border: "2px solid purple"
            }}
        >
            <span>{env === "xrplMain" ? "XRPL LABS MAINNET" : env === "xrplDev" ? "XRPL LABS DEVNET" : "XRPL LABS TESTNET"}</span>
        </div>
    );
}
