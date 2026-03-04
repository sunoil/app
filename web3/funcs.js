import Web3 from 'web3';
import Web3Conection from './ABI/web3Conection.json';
const BSC_TESTNET_RPC = 'https://avalanche-mainnet.infura.io/v3/4f142dc74f6541999c73d152110da5d0';

const usdt = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
const weth = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const usdc = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const usdce = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
const pusdt = '0xb73B8b9e6961831644c1BA9b0a10731ade3f7C8E';
const arb = '0x912CE59144191C1204E64559FE8253a0e49E6548';
const pirusd = '0x12889CC1eeeF2FDd757529FD2c6ACa616e0508Cb';

const Contract_Address = "0xa407e4e34fe3d081a2F563F9552B22668bf609A1";

const StakingStorage_Address = "0x517353a3c1bebbaa8b1fcabed172207fbf6511c9";

const StakingLogic_Address = "0x58924c1237b6e1dcd483410be7f89059ff3ef902";

const loadWeb3 = async () => {
    if (window.ethereum) {
        window.web3 = new Web3(ethereum);
        try {
            // Request account access if needed
            await ethereum.enable();
            // Acccounts now exposed
            web3.eth.sendTransaction({method: 'eth_requestAccounts'});
        } catch (error) {
            // User denied account access...
        }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
        // Acccounts always exposed
        web3.eth.sendTransaction({/* ... */});
    }
    // Non-dapp browsers...
    else {
        console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    }
};

// Read-only: fetch pirusd balance for any wallet address (no MetaMask needed)
export const getPirusdBalance = async (address) => {
    const web3ReadOnly = new Web3(BSC_TESTNET_RPC);
    const contract = new web3ReadOnly.eth.Contract(Web3Conection.output.abi, pirusd);
    const decimals = await contract.methods.decimals().call();
    const raw = await contract.methods.balanceOf(address).call();
    return parseFloat(raw) / Math.pow(10, Number(decimals));
};

// Transfer(address,address,uint256) event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Fetch all incoming pirusd Transfer events to a wallet address (from Mar 3 2026 onward)
export const getPirusdTransfers = async (address) => {
    const web3ReadOnly = new Web3(BSC_TESTNET_RPC);
    const contract = new web3ReadOnly.eth.Contract(Web3Conection.output.abi, pirusd);
    const decimals = Number(await contract.methods.decimals().call());
    const divisor = Math.pow(10, decimals);

    // Pad the wallet address to 32 bytes for topic filtering
    const paddedTo = '0x' + address.toLowerCase().replace('0x', '').padStart(64, '0');

    // Cutoff: Mar 3 2026 00:00:00 UTC
    const cutoffTimestamp = Math.floor(new Date(2026, 2, 3).getTime() / 1000);

    // Estimate a starting block: Avalanche C-Chain ~2s block time
    // Get current block and go back ~1 day worth of blocks as safety margin
    const latestBlock = await web3ReadOnly.eth.getBlockNumber();
    const blocksPerDay = 43200; // ~2s per block
    const fromBlock = Number(latestBlock) - (blocksPerDay * 2); // 2 days back

    // Use eth.getPastLogs — Web3.js v4 API
    const logs = await web3ReadOnly.eth.getPastLogs({
        address: pirusd,
        topics: [
            TRANSFER_TOPIC,
            null,       // from: any sender
            paddedTo,   // to: the wallet
        ],
        fromBlock: Math.max(0, fromBlock),
        toBlock: 'latest',
    });

    // Decode logs and fetch block timestamps
    const transfers = await Promise.all(logs.map(async (log) => {
        const block = await web3ReadOnly.eth.getBlock(log.blockNumber);
        const from = '0x' + log.topics[1].slice(26); // extract address from padded topic
        const amount = parseFloat(BigInt(log.data).toString()) / divisor;
        return {
            date: new Date(Number(block.timestamp) * 1000),
            amount,
            from,
            txHash: log.transactionHash,
        };
    }));

    // Filter by cutoff date
    const cutoff = new Date(2026, 2, 3);
    cutoff.setHours(0, 0, 0, 0);
    const filtered = transfers.filter(t => t.date >= cutoff);

    // Sort newest first
    filtered.sort((a, b) => b.date - a.date);

    const totalRewards = filtered.reduce((sum, t) => sum + t.amount, 0);

    return { transfers: filtered, totalRewards };
};

export const loadData = async () => {
    await loadWeb3();
    const addressAccount = await window.web3.eth.getCoinbase();
    const EthContract = window.web3.eth.Contract;
    const Contract_Web3_Conection = new EthContract(Web3Conection.output.abi, Contract_Address);
    const StakingStorage_Web3_Conection = new EthContract(Web3Conection.output.abi, StakingStorage_Address);
    const StakingLogic_Web3_Conection = new EthContract(Web3Conection.output.abi, StakingLogic_Address);
    const usdt_Web3_Conection = new EthContract(Web3Conection.output.abi, usdt)
    const weth_Web3_Conection = new EthContract(Web3Conection.output.abi, weth)
    const usdc_Web3_Conection = new EthContract(Web3Conection.output.abi, usdc)
    const usdce_Web3_Conection = new EthContract(Web3Conection.output.abi, usdce)
    const pusdt_Web3_Conection = new EthContract(Web3Conection.output.abi, pusdt)
    const arb_Web3_Conection = new EthContract(Web3Conection.output.abi, arb)
    const pirusd_Web3_Conection = new EthContract(Web3Conection.output.abi, pirusd)
    
    
    
    //const usdt_contract=new Contract(Web3Conection.output.abi, Contract_Address);
    
    
    const number = 1;
    
    const deposit = await Contract_Web3_Conection.methods.checkDeposit(addressAccount).call();
    const seenDeposit = await web3.utils.fromWei(deposit,'ether');

    const balanceofUSDT_pusdt= await pusdt_Web3_Conection.methods.balanceOf(addressAccount).call();
    const USDTpusdtDeposit = await web3.utils.fromWei(balanceofUSDT_pusdt,'ether');

    const balanceof_pirusd= await pirusd_Web3_Conection.methods.balanceOf(addressAccount).call();
    const reward = await Contract_Web3_Conection.methods.checkRewards(addressAccount).call();
    const seenReward = await web3.utils.fromWei(reward,'ether');
    const startTime = await Contract_Web3_Conection.methods.checkstartTime(addressAccount).call();
    const lockTime = await Contract_Web3_Conection.methods.checklockTime(addressAccount).call();

    
    return { Contract_Web3_Conection, StakingLogic_Web3_Conection, StakingStorage_Web3_Conection, addressAccount, number, deposit, balanceofUSDT_pusdt, reward, startTime, seenDeposit, USDTpusdtDeposit, balanceof_pirusd,seenReward, usdt, pirusd, weth, usdc, usdce, pusdt, arb, usdt_Web3_Conection, weth_Web3_Conection, usdc_Web3_Conection, usdce_Web3_Conection, arb_Web3_Conection,weth_Web3_Conection,pirusd_Web3_Conection, lockTime, Contract_Address, StakingLogic_Address,  StakingStorage_Address};
};