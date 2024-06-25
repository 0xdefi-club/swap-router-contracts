import { ethers } from 'hardhat'
import { deployOrConnect, writeChainInfo } from './helper'
import { factoryAddress, nonfungiblePositionManagerAddress } from './constant'

export async function deploy() {
  const [deployer] = await ethers.getSigners()
  await writeChainInfo()

  const tokenValidator = await deployOrConnect({
    name: 'TokenValidator',
    args: [factoryAddress, nonfungiblePositionManagerAddress],
    label: 'TokenValidator'
  })


  return {
    tokenValidator
  }
}

deploy()
