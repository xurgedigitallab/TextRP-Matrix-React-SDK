import axios from 'axios';
import React, { useEffect, useState } from 'react'
import SdkConfig from '../../../../../SdkConfig';

const EnvLabel = () => {
    const [env,setEnv]=useState('MAIN');
    useEffect(()=>{
      axios.get(`${SdkConfig.get().backend_url}/get-all-env`).then(res=>{
        setEnv(res.data[0].value==='xrplMain'?'MAIN':res.data[0].value==="xrplDev"?'DEV':'TEST')
      }).catch(err=>{
        console.log(err)
      })
    },[])
    
  return (
    <div style={{
      display:"flex",
      justifyContent:"start",
      alignItems:"center",
      width:"auto",
      fontSize:"16px",
      backgroundColor:"#f4f6fa",
      borderRadius:"5px",
      paddingInline:"16px",
      paddingBlock:"10px",
      gap:"10px"
    }}>Environment : <span style={{
      // fontWeight:"bold",
      paddingInline:"10px",
      paddingBlock:"3px",
      backgroundColor:"#3052ff",
      color:"white",
      borderRadius:"5px"
    }}>{env}</span></div>
  )
}

export default EnvLabel