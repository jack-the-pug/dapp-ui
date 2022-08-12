import { BigNumber, utils } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { hooks as metaMaskHooks } from '../../connectors/metaMask'
import {
  BasePool,
  DPoolEvent,
  GetPoolRes,
  PoolState,
  TokenMeta,
} from '../../type'
import useDPoolContract from '../../hooks/useDPool'
import { EosIconsBubbleLoading } from '../../components/icon'
import { useNavigate } from 'react-router-dom'
import useDPoolAddress from '../../hooks/useDPoolAddress'
import useTokenMeta from '../../hooks/useTokenMeta'
import { LOCAL_STORAGE_KEY } from '../../store/storeKey'
import { DistributePageCache, TPoolRow } from '../distribution/CreatePool'
import { Fund } from './Fund'
import { Cancel } from './Cancel'
import { Distribute } from './Distribute'
import { Claimer, DistributeRow } from './DistributeRow'
import { DateRange } from '../distribution/DateRangePicker'
import { DistributeState } from './DistributeState'

export type Pool = BasePool & {
  state: PoolState
}

const { useAccount, useChainId } = metaMaskHooks

export function PoolDetail({ poolId }: { poolId: string }) {
  const navigate = useNavigate()
  const { dPoolAddress, isOwner } = useDPoolAddress()

  const { getToken } = useTokenMeta()
  const account = useAccount()
  const chainId = useChainId()
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const dPoolContract = useDPoolContract(dPoolAddress)
  const [isApproved, setIsApproved] = useState<boolean>(false)

  const [poolMeta, setPoolMeta] = useState<Pool>()
  const [tokenMeta, setTokenMeta] = useState<TokenMeta>()

  const submittable = useMemo(() => {
    if (!poolMeta) return false
    if (BigNumber.from(poolMeta.token).eq(0)) return true
    return poolMeta.state === PoolState.Funded
  }, [poolMeta?.token, isApproved])

  const poolList = useMemo((): Claimer[] => {
    if (!poolMeta) return []
    return poolMeta.claimers.map((claimer, index) => ({
      address: claimer,
      amount: poolMeta.amounts[index],
    }))
  }, [poolMeta])
  useEffect(() => {
    if (!poolMeta) return
    const tokenAddress = poolMeta.token
    getToken(tokenAddress).then((meta) => meta && setTokenMeta(meta))
  }, [poolMeta, getToken])

  // format table data
  const getPoolDetail = useCallback(async () => {
    if (!dPoolContract || !poolId) return
    setPoolMeta(undefined)
    setIsLoading(true)
    try {
      const poolRes: GetPoolRes = await dPoolContract.getPoolById(poolId)
      console.log('poolRes', poolRes[0])
      const {
        amounts,
        claimedAmount,
        claimers,
        deadline,
        distributor,
        totalAmount,
        name,
        startTime,
        escrowedAmount,
        token,
      } = poolRes[0]
      const state = poolRes[1]
      const _poolMeta = {
        amounts,
        claimedAmount,
        claimers,
        deadline,
        distributor,
        totalAmount,
        name,
        startTime,
        escrowedAmount,
        token,
        state,
      }
      if (startTime !== 0) {
        setPoolMeta(_poolMeta)
      }
      setIsLoading(false)
    } catch {
      setIsLoading(false)
    }
  }, [dPoolContract, account, poolId, chainId])
  useEffect(() => {
    if (!dPoolContract) return
    dPoolContract
      .queryFilter(dPoolContract.filters[DPoolEvent.Claimed]())
      .then((res) => console.log('res', res))
  }, [dPoolContract])
  useEffect(() => {
    if (dPoolAddress && dPoolContract && poolId && chainId) {
      getPoolDetail()
    }
  }, [dPoolContract, account, poolId, chainId])

  const distributeAgain = useCallback(() => {
    if (!poolMeta || !tokenMeta) return

    const poolList = poolMeta.claimers.map(
      (address: string, index: number): TPoolRow => ({
        address,
        userInputAmount: utils.formatUnits(
          poolMeta.amounts[index],
          tokenMeta.decimals
        ),
        key: address,
      })
    )
    const distributePageCache: DistributePageCache = {
      poolList,
      tokenMetaList: [tokenMeta],
      poolName: poolMeta.name,
    }
    localStorage.setItem(
      LOCAL_STORAGE_KEY.DISTRIBUTE_CATCH_DATA,
      JSON.stringify(distributePageCache)
    )
    navigate('/')
  }, [poolMeta, tokenMeta])

  if (isLoading)
    return (
      <p className="w-full flex justify-center">
        <EosIconsBubbleLoading width="5em" height="5em" />
      </p>
    )
  if (!poolId) return <p>PoolId not found</p>
  if (!poolMeta) return <p>Distribute not found</p>
  return (
    <div className="flex justify-center">
      <div className="w-full break-all flex flex-1 flex-col items-center bg-white px-4 py-2 rounded-lg">
        <div className="my-5 w-full relative items-center flex justify-center">
          <div className="flex">
            {poolMeta?.name}
            <DistributeState
              state={poolMeta?.state}
              title={PoolState[poolMeta.state]}
            />
          </div>
        </div>
        <table className="my-4">
          <thead className="text-sm">
            <tr className="text-gray-500 bg-gray-100">
              <td>Index</td>
              <td className="py-3">Address</td>
              <td>
                Amount/<span>{tokenMeta?.symbol}</span>
              </td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {poolList.map((claimer, index) => (
              <DistributeRow
                key={claimer.address}
                claimer={claimer}
                index={index}
                poolMeta={poolMeta}
                dPoolAddress={dPoolAddress}
                tokenMeta={tokenMeta}
                poolId={poolId}
              />
            ))}
          </tbody>
        </table>

        <section className="text-xs w-full flex flex-col gap-4 mt-20">
          <DateRange start={poolMeta.startTime} end={poolMeta.deadline} />
        </section>
        <div className="w-full mt-10 text-black">
          <Fund
            poolMeta={poolMeta}
            dPoolAddress={dPoolAddress}
            tokenMeta={tokenMeta}
            poolId={poolId}
            getPoolDetail={getPoolDetail}
            isApproved={isApproved}
            setIsApproved={setIsApproved}
          />
          <Distribute
            poolMeta={poolMeta}
            dPoolAddress={dPoolAddress}
            poolId={poolId}
            getPoolDetail={getPoolDetail}
            submittable={submittable}
            tokenMeta={tokenMeta}
          />
        </div>
        <div className="flex mt-4 gap-2 w-full justify-between">
          {isOwner ? (
            <div
              className="text-xs cursor-pointer text-gray-400 hover:text-gray-500 "
              onClick={distributeAgain}
            >
              Duplicate Distribution
            </div>
          ) : null}
          <Cancel
            poolMeta={poolMeta}
            dPoolAddress={dPoolAddress}
            isOwner={isOwner}
            poolId={poolId}
            getPoolDetail={getPoolDetail}
          />
        </div>
      </div>
    </div>
  )
}
