/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { useCallback, useState } from "react";
import axios from 'axios'
import { MatrixClientPeg } from "../MatrixClientPeg";
import { useLatestResult } from "./useLatestResult";
import { isValidClassicAddress } from 'ripple-address-codec';
export interface IProfileInfoOpts {
    query?: string;
}

export interface IProfileInfo {
    user_id: string;
    avatar_url?: string;
    display_name?: string;
    address_link?:string
}

export const useProfileInfo = (): {
    ready: boolean;
    loading: boolean;
    profile: IProfileInfo | null;
    isActive:boolean,
    search(opts: IProfileInfoOpts): Promise<boolean>;
} => {
    const [profile, setProfile] = useState<IProfileInfo | null>(null);
    
    const [isActive,setIsActive]=useState<boolean>(false);

    const [loading, setLoading] = useState(false);

    const [updateQuery, updateResult] = useLatestResult<string | undefined, IProfileInfo | null>(setProfile);

    const extractWalletAddress =(inputString:string)=>{
        // Define a regular expression pattern to match XRPL addresses
        const addressRegex = /@([a-zA-Z0-9]{25,34})/;
      
        // Use the RegExp.exec method to find the address in the input string
        const match = addressRegex.exec(inputString);
      
        // Check if a match was found and extract the address
        if (match && match[1]) {
          return match[1];
        }
      
        // Return null if no address was found
        return null;
      }
      
     
     
      
      
      

    const search = useCallback(
        async ({ query: term }: IProfileInfoOpts): Promise<boolean> => {
            updateQuery(term);
            if (!term?.length || !term.startsWith("@") || !term.includes(":")) {
                setProfile(null);
                return true;
            }

            setLoading(true);
            try {
                const result = await MatrixClientPeg.get().getProfileInfo(term);
                updateResult(term, {
                    user_id: result.user_id?result.user_id:term,
                    avatar_url: result.avatar_url,
                    display_name: result.displayname,
                });
                return true;
            } catch (e) {
                if(isValidClassicAddress(extractWalletAddress(term))){
                    const response=await axios.get(`https://backend.textrp.io/verify-address/${extractWalletAddress(term)}`).then((response)=>response.data);
                    if(response.active)
                        setIsActive(true);
                    else
                        setIsActive(false);
                    // if(response.active){
                    //   const link= await axios.post(`https://backend.textrp.io/accounts/${extractWalletAddress(term)}/payments`,{
                    //         message:"my first transaction", 
                    //         amount:"2000",
                    //     },{
                    //         headers: {
                    //           'Content-Type': 'application/json', // Set the content type to JSON
                    //         },
                    //       }).then((response)=>response.data);
                    //     console.log('!!!!!!!!!ACTIVE',link);
                    // }
                }else{
                    setIsActive(false);
                }
               
                console.error("Could not fetch profile info for params", { term }, e);
                updateResult(term, null);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [updateQuery, updateResult],
    );

    return {
        ready: true,
        loading,
        profile,
        isActive,
        search,
    } as const;
};
