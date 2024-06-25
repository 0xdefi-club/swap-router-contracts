import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { Contract, ContractFactory, MaxUint256, ParamType } from "ethers"
import fs from "fs"
import { ethers } from "hardhat"
import * as path from "path"
import hre from "hardhat"

const chainId = hre.network.config.chainId || 31337
const network = process.env.HARDHAT_NETWORK || "localhost"
let contractAddressesFilepath = path.join(
  __dirname,
  "..",
  `/env/${process.env.HARDHAT_NETWORK || "localhost"}/addresses/${chainId}.json`
)

interface DeployProps {
  name: string
  args?: any[]
  label?: string
  libraries?: { [libraryName: string]: string }
}

export const parseEther = (amountLike: string | number) => {
  return ethers.parseEther(amountLike.toString())
}

export const parseUnits = (amountLike: string | number, decimals: number) => {
  return ethers.parseUnits(amountLike.toString(), decimals)
}

export const formatEther = (amount: any) => {
  return ethers.formatEther(amount)
}

export const formatUnits = (amount: any, decimals: number) => {
  return ethers.formatUnits(amount, decimals)
}

export const toUsd = (amountLike: string | number) => {
  return parseUnits(amountLike, 30)
}

export function toDate(timestamp: any, locals = {}, options = {}) {
  const numericTimestamp = Number(timestamp)

  const date = new Date(numericTimestamp * 1000)
  // @ts-ignore
  const localTime = date.toLocaleString(locals, options)

  return localTime
}

export function toOraclePrice(amount: string | number) {
  return ethers.parseUnits(amount + "", 8)
}

export const approveMax = (
  token: Contract,
  spenderAddr: string,
  user?: any
) => {
  if (user) {
    return handleTx(
      //@ts-ignore
      token.connect(user).approve(spenderAddr, MaxUint256),
      "approve token max"
    )
  } else {
    return handleTx(token.approve(spenderAddr, MaxUint256), "approve token max")
  }
}

export function getDiff(
  value1: string | number,
  value2: string | number
): number {
  const num1 = Number(value1)
  const num2 = Number(value2)

  return num1 > num2 ? num1 - num2 : num2 - num1
}

export const deployOrConnect = async ({
  name,
  args = [],
  label,
  libraries,
}: DeployProps): Promise<Contract> => {
  let contractKey = label ? label : name
  if (chainId != 31337 || network != "localhost") {
    let existingObj = await readContracts()
    let contractAddress = existingObj[contractKey]
    if (contractAddress) {
      console.debug(
        `Connecting to ${label ? label : name} at ${contractAddress}`
      )
      return await ethers.getContractAt(name, contractAddress)
    }
  }
  console.debug(
    `=====================Deploying ${label ? label : name
    }=====================`
  )

  // Check if there are libraries to link
  let contractFactory: ContractFactory

  if (libraries) {
    contractFactory = await ethers.getContractFactory(name, {
      libraries,
    })
  } else {
    contractFactory = await ethers.getContractFactory(name)
  }

  const deployingContract = await contractFactory.deploy(...args)

  const contract = await deployingContract
    .waitForDeployment()
    .then((contract) => {
      console.debug(
        `Deployed ${label ? label : name} to ${contract.target
        }\n===========================================================\n`
      )
      return contract as Contract
    })
    .catch((err) => {
      console.error(err)
      process.abort()
    })

  writeContracts({ [contractKey]: contract.target })
  return contract
}

export const debuggerHandleTx = (txPromise: any, label?: string) => {
  return txPromise
    .then((tx: any) => {
      console.log(`=====Transaction=====\nTx hash: ${tx.hash}`)
      return tx.wait()
    })
    .then((receipt: any) => {
      console.log(`Tx mined in block ${receipt.blockNumber}`)
      console.log(`${label} ✨success!\n=====================`)
      return receipt
    })
    .catch((err: any) => {
      console.error(
        `=====Transaction=====\n${label} 🛑Tx failed: ${err}\n=====================`
      )
      process.abort()
    })
}

export const handleTx = (txPromise: any, label?: string) => {
  return txPromise
    .then((tx: any) => {
      console.log(`=====Transaction=====\nTx hash: ${tx.hash}`)
      return tx.wait()
    })
    .then((receipt: any) => {
      console.log(`Tx mined in block ${receipt.blockNumber}`)
      console.log(`${label} ✨success!\n=====================`)
      return receipt
    })
    .catch((err: any) => {
      console.error(
        `=====Transaction=====\n${label} 🛑Tx failed: ${err}\n=====================`
      )
    })
}

const readContracts = () => {
  if (network == "localhost") return {}

  if (contractAddressesFilepath === "") {
    contractAddressesFilepath = _getFilePath(network)
  }

  if (fs.existsSync(contractAddressesFilepath)) {
    const parsedJson = JSON.parse(
      fs.readFileSync(contractAddressesFilepath).toString()
    )
    return parsedJson.addresses
  }
  return {}
}

export const writeContracts = async (json: any) => {
  // if (chainId === 31337) return
  const tmpAddresses = fs.existsSync(contractAddressesFilepath)
    ? JSON.parse(fs.readFileSync(contractAddressesFilepath, "utf-8"))
    : {}
  const env = {
    chainInfo: { ...tmpAddresses.chainInfo },
    addresses: { ...tmpAddresses.addresses, ...json },
  }
  _ensureDirectoryExistence(contractAddressesFilepath)
  fs.writeFileSync(contractAddressesFilepath, JSON.stringify(env))
}


export const writeChainInfo = async () => {
  const tmpAddresses = fs.existsSync(contractAddressesFilepath)
    ? JSON.parse(fs.readFileSync(contractAddressesFilepath, "utf-8"))
    : {}
  const info = {
    chainInfo: {
      chainId: chainId,
      network: network,
      startBlock: await ethers.provider.getBlockNumber(),
      rpc: (hre.config.networks[network] as any)?.url
    },
    addresses: { ...tmpAddresses.addresses },
  }
  _ensureDirectoryExistence(contractAddressesFilepath)
  fs.writeFileSync(contractAddressesFilepath, JSON.stringify(info))
}

export const grantRoleIfNotGranted = async (
  granter: any,
  granteeAddr: string,
  role: number,
  label?: string
) => {
  let granted = await granter.hasRole(role, granteeAddr)
  if (granted[0]) {
    console.log(
      "granter: %s's role: %s already granted",
      granter.target.toString(),
      role,
      granteeAddr
    )
    return
  }
  await handleTx(
    granter.grantRole(role, granteeAddr, 0),
    `${label ? label : ""}`
  )
}

const removeFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export const removeAddresses = () => {
  removeFile(_getFilePath(network))
}
// user config
const _getFilePath = (chainName?: string) => {
  return (contractAddressesFilepath = path.join(
    __dirname,
    "..",
    `/env/${chainName}/addresses/${chainId}.json`
  ))
}

const _ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return true
  }
  _ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

export const sendEthers = async ({
  from,
  to,
  amount,
}: {
  from: HardhatEthersSigner
  to: string
  amount: BigInt
}) => {
  return await handleTx(
    from.sendTransaction({
      to: to,
      value: ethers.parseEther(amount.toString()),
    }),
    "send ethers"
  )
}

export function hashData(
  dataTypes: readonly (string | ParamType)[],
  dataValues: readonly any[]
) {
  const bytes = ethers.AbiCoder.defaultAbiCoder().encode(dataTypes, dataValues)
  const hash = ethers.keccak256(bytes)
  return hash
}

export function getMarketKey(dataValues: readonly any[]) {
  const bytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    dataValues
  )
  const hash = ethers.keccak256(bytes)
  return hash
}

export function getPositionKey(dataValues: readonly any[]) {
  const bytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "address", "bool", "uint256"],
    dataValues
  )
  const hash = ethers.keccak256(bytes)
  return hash
}

export function getClaimableFundingAmountKey(dataValues: readonly any[]) {
  const bytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256"],
    dataValues
  )
  const hash = ethers.keccak256(bytes)
  return hash
}

export function getVaultOpenInterestKey(dataValues: readonly any[]) {
  const bytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bool"],
    dataValues
  )
  const hash = ethers.keccak256(bytes)
  return hash
}

export function getExecutionFeeKey() {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string"],
      ["CONFIG", "EXECUTION_FEE"]
    )
  )
}

export function expandToMultiplier(amount: number) {
  return amount * 10000
}

export function formatUsd(amount: number | string | bigint) {
  return formatUnits(BigInt(amount), 30)
}

export function logRedundancePosition(positionInfo: {
  position: {
    [x: string]: any
  }
  // positionKeyInfo: {
  //   tokenId: { toString: () => any }
  //   collateralTokenVault: any
  //   indexToken: any
  //   isLong: any
  //   giantTokenId: { toString: () => any }
  // }
  collateralToken: any
}) {
  let position = positionInfo.position
  let positionF = {
    type: "position",
    tokenId: position.keyInfo.tokenId.toString(),
    collateralTokenVault: position.keyInfo.collateralTokenVault,
    indexToken: position.keyInfo.indexToken,
    isLong: position.keyInfo.isLong,
    giantTokenId: position.keyInfo.giantTokenId.toString(),
    collateralToken: positionInfo.collateralToken,
    size: formatUsd(position.size),
    collateral: formatUsd(position.collateral),
    averagePrice: formatUsd(position.averagePrice),
    fundingPerSize: position.fundingPerSize,
    realisedPnL: formatUsd(position.realisedPnL),
    shares: formatUsd(position.shares),
    // lastIncreasedTime: toDate(position.lastUpdateInfo.lastIncreasedTime),
    // lastDecreasedTime: toDate(position.lastUpdateInfo.lastDecreasedTime),
    // lastCollateralTokenPrice: toUsd(
    //   position.lastUpdateInfo.lastCollateralTokenPrice.min
    // ),
    // lastIndexTokenPrice: toUsd(
    //   position.lastUpdateInfo.lastIndexTokenPrice.min
    // ),
  }
  console.table(positionF)
}

export function logRedundanceOrder(order: {
  orderId: { toString: () => any }
  createAt: any
  tokenId: { toString: () => any }
  collateralTokenVault: any
  collateralToken: any
  indexToken: any
  isLong: any
  isIncrease: any
  isLimit: any
  amountIn: any
  collateralDelta: any
  sizeDelta: any
  triggerPrice: any
  isTriggerAbove: any
  receiver: any
}) {
  let orderF = {
    // meta
    type: "order",
    orderId: order.orderId.toString(),
    createAt: toDate(order.createAt),
    //  request
    tokenId: order.tokenId.toString(),
    collateralTokenVault: order.collateralTokenVault,
    collateralToken: order.collateralToken,
    indexToken: order.indexToken,
    isLong: order.isLong,
    side: order.isIncrease ? "increase" : "decrease",
    // @ts-ignore
    type: order.isLimit ? "limit" : "market",
    amountIn: formatEther(order.amountIn), // TODO update field like this to formatToken(amount, decimals)
    collateralDelta: formatUsd(order.collateralDelta),
    sizeDelta: formatUsd(order.sizeDelta),
    triggerPrice: formatUsd(order.triggerPrice),
    isTriggerAbove: order.isTriggerAbove,
    receiver: order.receiver,
  }
  // console.table(orderF, ["OrderKeys", "Values"])
  console.table(orderF)
}

export const removeFiles = () => {
  //  remove file on each deploy
  if (
    !process.env.HARDHAT_NETWORK ||
    process.env.HARDHAT_NETWORK == undefined ||
    process.env.HARDHAT_NETWORK == "local" ||
    process.env.HARDHAT_NETWORK == "localhost"
  ) {
    const addressesPath = path.resolve(__dirname, "../addresses")
    console.log("exxxxxx", addressesPath)
    const fileName = `${addressesPath}/31337.json`
    if (fs.existsSync(fileName)) {
      fs.unlinkSync(fileName)
    }
    const localModeFileName = `${addressesPath}/contract-addresses-local.json`
    if (fs.existsSync(localModeFileName)) {
      fs.unlinkSync(localModeFileName)
    }
  }
}

export const connectLocal = async ({
  name,
  label,
}: DeployProps): Promise<Contract | null> => {
  let contractKey = label ? label : name
  if (contractAddressesFilepath === "") {
    contractAddressesFilepath = _getFilePath(network)
  }
  const parsedJson = JSON.parse(
    fs.readFileSync(contractAddressesFilepath).toString()
  )
  let existingObj = parsedJson.addresses

  let contractAddress = existingObj[contractKey]
  return contractAddress
    ? (async () => {
      console.debug(
        `Connecting to ${label ? label : name} at ${contractAddress}`
      )
      return await ethers.getContractAt(name, contractAddress)
    })()
    : null
}


export async function increaseBlockTimestamp(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds])
  await ethers.provider.send("evm_mine")
}

export async function increaseBlockNumber(blocks: number) {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine")
  }
}

export async function getBlockInfo() {
  const block = await ethers.provider.getBlock("latest")

  const timestamp = block?.timestamp
  const number = block?.number

  console.log("Current Block Number:", number)
  console.log("Current Block Timestamp:", timestamp)

  return { timestamp, number }
}

export function bigNumberify(n: number) {
  return BigInt(n)
}

export function expandDecimals(n: any, decimals: number) {
  return bigNumberify(n) * (bigNumberify(10) ^ BigInt(decimals))
}

export function decimalToFloat(value: any, decimals = 0) {
  return expandDecimals(value, 30 - decimals)
}
