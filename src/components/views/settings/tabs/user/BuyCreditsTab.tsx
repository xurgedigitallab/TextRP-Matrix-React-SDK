/* eslint-disable matrix-org/require-copyright-header */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import React, { useEffect } from "react";
import axios from "axios";

import { OwnProfileStore } from "../../../../../stores/OwnProfileStore";
// import { OwnProfileStore } from "../../../stores/OwnProfileStore";
// import ArrowLeft from '@public/Icons/setting/arrow.svg'
import Heading from "../../../typography/Heading";
import SdkConfig from "../../../../../SdkConfig";

// import useSWR from 'swr'
// import Dropdown from '../common/Dropdown'
// import Loader from '../common/Loader'
// import Button from '../UI/Button'
// import { swrFetcher } from '@/helpers'

const URL: string = SdkConfig.get("backend_url") ? SdkConfig.get("backend_url") : "https://backend.textrp.io";

const BuyCredits = () => {
    const [isMount] = React.useState(true);
    //   const [isPaying, setIsPaying] = useState(false)
    const userData = async () =>
        await axios.get(`${URL}/me`, {
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
        });

    useEffect(() => {
        userData();
        console.log(OwnProfileStore.instance);
    }, []);

    //   const { data: creditData, isLoading, mutate } = useSWR('/api/admin/credits', swrFetcher)
    //   const { data: usdXrpPriceData, isLoading: isPriceLoading } = useSWR(
    // 'https://api.binance.com/api/v3/avgPrice?symbol=XRPUSDT',
    // swrFetcher
    //   )
    //   const dropdownItems = useMemo(() => {
    // return creditData?.data?.map(
    //   (cd: { available_credits: number; price: number }) =>
    // `${cd.available_credits} credits for ${cd.price} XRP`
    // )
    //   }, [creditData])

    //   const [selectedOption, setSelectedOption] = useState<string | undefined>(
    // dropdownItems && dropdownItems[0]
    //   )

    //   useEffect(() => {
    // if (dropdownItems) {
    //   setSelectedOption(dropdownItems[0])
    // }
    //   }, [dropdownItems])

    //   useEffect(() => {
    //     if (isMount) {
    //       setMount(false)
    //     }
    //   }, [isMount])

    //   const handleBuyCredits = () => {
    //     setIsPaying(true)
    //     // const CREDIT_ID = creditData?.data[dropdownItems.indexOf(selectedOption)]?.id
    //     axios
    //       .post(`/api/user/creditPayment/${CREDIT_ID}`)
    //       .then((res: { data: { data: { next: { always: string | URL | undefined } } } }) => {
    //         if (!isMount && window) {
    //           window.open(res?.data?.data?.next?.always, '_blank')
    //           setIsPaying(false)
    //         }
    //         console.log(res.data)
    //       })
    //       .catch((err) => {
    //         console.log(err)
    //         setIsPaying(false)
    //       })
    //   }

    return (
        <div
            className={` md:transform-none settingPanel min-h-screen max-h-screen overflow-hidden bg-white dark:bg-gray-bg-dark py-6  relative border-r-[0.5px] border-primary-gray dark:border-secondary-text ${
                isMount ? "translate-x-full" : "translate-x-0"
            } transition duration-300`}
        >
            <div className="flex gap-5 items-center px-4 md:px-8 ">
                <Heading size="h2">Buy Credits</Heading>
            </div>

            <div className="overflow-y-auto h-full px-4 md:px-8 ">
                {/* {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader />
          </div>
        ) : ( */}
                <>
                    <div className="text-base font-normal my-8">
                        <p className="">Your credits balance</p>
                        <p className="font-semibold">
                            {/* {parseFloat(String(userData?.user?.credit?.balance)).toFixed(2)} */}
                        </p>
                    </div>
                    <div className="text-base font-normal my-8">
                        <p className="mb-2">Select the amount to buy</p>
                        {/* <Dropdown */}
                        {/* dropdownList={dropdownItems} */}
                        {/* selectedOption={selectedOption} */}
                        {/* setSelectedOption={setSelectedOption} */}
                        {/* /> */}
                    </div>
                    <div className="text-base font-normal my-8">
                        <p className="">You will be charged</p>
                        <p className="font-semibold">
                            {
                                //   `${
                                // creditData?.data[dropdownItems.indexOf(selectedOption)]?.price
                                //   } XRP (${
                                // !isPriceLoading && usdXrpPriceData?.price
                                //   ? (
                                //   usdXrpPriceData?.price *
                                //   creditData?.data[dropdownItems.indexOf(selectedOption)]?.price
                                // ).toFixed(2)
                                //   : '-'
                                //   } USD)`
                            }
                        </p>
                    </div>
                    <div className="text-base font-normal my-8">
                        <p className="">Your new credits balance will be</p>
                        <p className="font-semibold">
                            {/* { */}
                            {/* ` */}
                            {/* //   ${( */}
                            {/* // parseFloat( */}
                            {/* //   String(creditData?.data[dropdownItems.indexOf(selectedOption)]?.available_credits) */}
                            {/* // ) + parseFloat(userData?.user?.credit?.balance ?? 0) */}
                            {/* //   ).toFixed(2)}`} */}
                        </p>
                    </div>
                    <button
                        //   onClick={handleBuyCredits}
                        //   loading={isPaying}
                        className="outline-none text-base font-normal rounded p-2 bg-primary-blue text-white w-full flex justify-center"
                    >
                        Buy Credits
                    </button>
                </>
                {/* )} */}
            </div>
        </div>
    );
};

export default BuyCredits;
