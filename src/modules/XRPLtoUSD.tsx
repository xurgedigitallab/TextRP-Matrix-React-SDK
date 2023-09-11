/* eslint-disable @typescript-eslint/explicit-function-return-type */
// eslint-disable-next-line matrix-org/require-copyright-header, @typescript-eslint/no-var-requires
const xrpl = require("xrpl");

export const getXRPLPrice = async () => {
    try {
        const client = new xrpl.Client("wss://s1.ripple.com");
        await client.connect();
        const response = await client.request({
            command: "book_offers",
            taker_pays: {
                currency: "USD",
                issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
            },
            taker_gets: {
                currency: "XRP",
            },
            ledger_index: "validated",
            limit: 1,
        });

        console.log(response.result);

        const price = 1 / (response.result.offers[0].TakerGets / 1000000 / response.result.offers[0].TakerPays.value);

        await client.disconnect();
        return price;
    } catch (err: any) {
        console.log(err);
    }
};
