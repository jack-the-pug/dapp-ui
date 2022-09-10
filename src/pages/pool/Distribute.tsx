import { useWeb3React } from '@web3-react/core'
import { BigNumber } from 'ethers'
import { useState, useCallback } from 'react'
import { ActionState } from '../../type/index'
import { PoolState, DPoolEvent, TokenMeta } from '../../type'
import { Pool } from './PoolDetail'
import { useCallDPoolContract } from '../../hooks/useContractCall'
import { Button } from '../../components/button'
import { EstimateGas } from '../../components/estimateGas'

interface DistributeProps {
  poolMeta: Pool | undefined
  dPoolAddress: string
  poolId: string
  getPoolDetail: Function
  submittable: boolean
  tokenMeta: TokenMeta | undefined
  getPoolEvent: Function
}
export function Distribute(props: DistributeProps) {
  const {
    poolMeta,
    dPoolAddress,
    submittable,
    poolId,
    getPoolDetail,
    tokenMeta,
    getPoolEvent,
  } = props

  const { account, chainId } = useWeb3React()
  const [distributionState, setDistributionState] = useState<ActionState>(
    ActionState.WAIT
  )
  const callDPool = useCallDPoolContract(dPoolAddress)
  const distributePool = useCallback(async () => {
    if (!poolId || !chainId) return
    setDistributionState(ActionState.ING)
    const result = await callDPool(
      'distribute',
      [poolId],
      DPoolEvent.Distributed
    )
    if (!result.success) {
      setDistributionState(ActionState.FAILED)
      return
    }
    setDistributionState(ActionState.SUCCESS)
    if (result.data.logs.length) {
      getPoolDetail()
      getPoolEvent()
    }
  }, [callDPool, chainId, poolMeta])

  if (!tokenMeta || !poolMeta) return null
  if (poolMeta.state !== PoolState.Funded) return null
  const distributor = BigNumber.from(poolMeta.distributor)
  if (distributor.eq(0)) return null
  if (!account) return null
  if (account.toLowerCase() !== poolMeta.distributor.toLowerCase()) return null

  return (
    <>
      <Button
        disable={!submittable}
        loading={distributionState === ActionState.ING}
        onClick={distributePool}
        className="mt-8"
      >
        Distribute
      </Button>
      <EstimateGas method="distribute" arg={[poolId]} />
    </>
  )
}
