const Web3 = require("web3");
const http = require("http");
const Web3HttpProvider = require("web3-providers-http");
const express = require('express');
const router = express.Router({caseSensitive: true});
const BigNumber = require('bignumber.js');
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '1123',
  database : 'cron'
});

connection.connect();

const options = {
  keepAlive: true,
  timeout: 100000,
  headers: [{ name: "Access-Control-Allow-Origin", value: "*" }],
  withCredentials: false,
  agent: new http.Agent({ keepAlive: true }),
};

// Web3 End Point 
const Main_RPC_URL="https://mainnet.infura.io/v3/{env.key}";
const OPTIMISM_RPC_URL="https://optimism-mainnet.infura.io/v3/{env.key}";

// Mainnet Contract Address 
const mHancainEpMainNetCA="0x5052fa4a2a147eaAa4c0242e9Cc54a10A4f42070";
const mStakingPrivateUniV2CA="0xe1D6aD723e20206A655b0677354d67BcD671b084";
const mStakingMunieV2CA="0x03d32959696319026bbDe564F128eB110AAbe7aF";
const mStakingSPRV2CA ="0xcEe864b8633b96f5542F25e0B9942Bf7557cc5c3";


// Mainnet ABIs
const MainHANEPABI=require("./abi/hanep/main/hanchainEp");
const StakingPrivateUniV2  = require("./abi/hanep/main/stakingPrivateUniV2");
const mStakingMunieV2ABI = require("./abi/hanep/main/stakingMunieV2");
const mStakingSPRV2 = require("./abi/hanep/main/stakingSPRV2");


// Optimism Contract Address 
const L2StandardERC20CA="0xC3248A1bd9D72fa3DA6E6ba701E58CbF818354eB";


// Optimism ABIs
const L2StandardERC20 = require("./abi/hanep/optimism/l2StandardERC20");

// Web3 Network Connection 
const optProvider = new Web3HttpProvider(OPTIMISM_RPC_URL, options);
const mainProvider = new Web3HttpProvider(Main_RPC_URL, options);
const oweb3 = new Web3(optProvider);
const mweb3 = new Web3(mainProvider);

/*
********************* View *************************
*/

router.get('/circulatingSupply', function(req, res, next) {
  var sql = 'SELECT circulation FROM hanep_circulation ORDER BY idx DESC LIMIT 1';
  connection.query(sql , function(err, rows, fields){
    if(err) console.log(err);
    let result = rows[0].circulation;
    res.send(result);
  });
});

router.get('/circulatingsupply', function(req, res, next) {
  var sql = 'SELECT circulation FROM han_circulation ORDER BY idx DESC LIMIT 1';
  connection.query(sql , function(err, rows, fields){
    if(err) console.log(err);
    let result = rows[0].circulation;
    res.send(result);
  });
});



// HANeP Process
router.get('/han',async function(req,res,next){
  // Total Supply : 225 million
  // wei : 225000000000000000000000000
  // ether : 225000000
  let totalSupply=new BigNumber(225000000000000000000000000);

  let subHanChainEpAmount =await getHanchainEpTokenSubValue();
  totalSupply = totalSupply.minus(subHanChainEpAmount);

  let addStakingPrivateUniV2= await getMainStakingPrivateUniV2PLUS();
  totalSupply = totalSupply.plus(addStakingPrivateUniV2);

  let addStMuv2Amount =await getMainStakingMunieV2();
  totalSupply = totalSupply.plus(addStMuv2Amount);

  let addSpr = await getMainStakingSPR();
  totalSupply = totalSupply.plus(addSpr);

  
  // wei to eth
  let ethResult = totalSupply.div(new BigNumber(10).pow(new BigNumber(18))).toString(10) ;

  // insert DB
  var sql = 'INSERT INTO hanep_circulation(circulation,c_date) VALUES(?, now())';
  let circulation  = ethResult;
  var params = [circulation];
  connection.query(sql, params, function(err, rows, fields){
    if(err) console.log(err);
    let result= "INSERTSUCCESS";
    res.send({result:result});
  });
});


/****************************************************
 Mainnet Process 
****************************************************/

async function getHanchainEpTokenSubValue(){
  let addr_list=[ '0x495fcd7f56a0bf8be1f29be02d1aa5f492f2ff66','0x19681f34afce6b7fadfb07cd34c8f20dcf0a4f2a','0x90a692e0819075c49100f9f5f2724e75d8a34711'
                  , '0xc7bdbcda0b8162427868ac41713d2559a9e2281c','0x3811f5674abbc216ad29a1edcdd0b05172a9f123','0xb365bB98c1469732eab3b2Ed7f6c8fc494A27977'  
                  ,'0x08FCaca90F40cF9184Da1F433d1F283A414AEb28','0x6A9c80Da002B4594000A822B8984C1A46b5b6f91','0x282b3c1fF58B3b4587A22f761Bb1B8D2994FEB01'];
  let sub_total = new BigNumber(0);
  for(let i=0;i<addr_list.length;i++){
    sub_total = sub_total.plus(await getMainHanchainEpBalanceByAddress(addr_list[i]));
  }
  return sub_total;
}

async function getMainHanchainEpBalanceByAddress(ownerAddress){
  const mainHanContract = await new mweb3.eth.Contract(MainHANEPABI.ABI, mHancainEpMainNetCA);
  const result = await mainHanContract.methods.balanceOf(ownerAddress).call();  
  return new BigNumber(result);
}

async function getMainStakingPrivateUniV2PLUS(){
  const ownerAddrs=["0xb365bB98c1469732eab3b2Ed7f6c8fc494A27977","0x08FCaca90F40cF9184Da1F433d1F283A414AEb28"];
  let opt_sub_total=new BigNumber(0);
  for(let i=0; i<ownerAddrs.length;i++){
    opt_sub_total = opt_sub_total.plus(await getMainStakingPrivateUniV2(ownerAddrs[i]));
  }
  return opt_sub_total ;
}

async function getMainStakingPrivateUniV2(ownerAddress){
  let muxValue=new BigNumber(12175.5928037506); //ether  12175.5928037506  wei 12175592803750600000000
  if(ownerAddress=='0xb365bB98c1469732eab3b2Ed7f6c8fc494A27977'){
    muxValue=new BigNumber(21916.0670467511);  // ether 21916.0670467511 wei 21916067046751100000000
  } 

  const stakingPrivateUniV2Contract = await new mweb3.eth.Contract(StakingPrivateUniV2.ABI, mStakingPrivateUniV2CA);
  const result = await stakingPrivateUniV2Contract.methods.balanceOf(ownerAddress).call();
  return muxValue.multipliedBy(new BigNumber(result));
}

async function getMainStakingMunieV2(){
  const muxValue=new BigNumber(36500000000000000000);
  const ownerAddr="0x6A9c80Da002B4594000A822B8984C1A46b5b6f91";
  const mainMunieContract = await new mweb3.eth.Contract(mStakingMunieV2ABI.ABI,mStakingMunieV2CA);
  let result =await mainMunieContract.methods.balanceOf(ownerAddr).call();
  let serverReturnValue = new BigNumber(result) ;
  const resultBig=muxValue.multipliedBy(serverReturnValue);
  return resultBig;
 }


async function getMainStakingSPR(){
 const muxValue=new BigNumber(36500000000000000000); //36500000000000000000  36.5
 const ownerAddr="0x282b3c1fF58B3b4587A22f761Bb1B8D2994FEB01";
 const mainSprContract = await new mweb3.eth.Contract(mStakingSPRV2.ABI,mStakingSPRV2CA);
 let result =await mainSprContract.methods.balanceOf(ownerAddr).call();
 let serverReturnValue = new BigNumber(result) ;
 const resultBig=muxValue.multipliedBy(serverReturnValue);
 return resultBig;
}


/***********************************************************************************
 Optimism Process (Coming Soon)
***********************************************************************************/

async function getOptHanchainEpTokenSubValue(){
  let opt_addr_list=['{}','{}','{}',
                    '{}'];
  let opt_sub_total=new BigNumber(0);
  for(let i=0; i<opt_addr_list.length;i++){
    opt_sub_total = opt_sub_total.plus(await getOptHanchainEpBalanceOptByAddress(opt_addr_list[i]));    
  }
  return opt_sub_total;
}

async function getOptHanchainEpBalanceOptByAddress(ownerAddress){
  const otpHanContract = await new oweb3.eth.Contract(L2StandardERC20.ABI, L2StandardERC20CA);
  const result = await otpHanContract.methods.balanceOf(ownerAddress).call();
  //console.log("가져온값" +result);
  return new BigNumber(result);
}


module.exports = router;
