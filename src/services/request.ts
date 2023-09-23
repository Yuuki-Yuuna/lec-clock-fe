import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { RequestResult } from './type'

import { ResponseData } from './type'
import { useLoginStore } from '../views/login/store/login'
const instance = axios.create({
  baseURL: '/api',
  timeout: 5000
})

instance.interceptors.request.use(
  (config) => {
    // 添加逻辑
    const useUser = useLoginStore() //在login/store
    if (useUser.token) {
      config.headers.Authorization = useUser.token
    }
    return config
  },
  (error) => {
    Promise.reject(error)
  }
)

instance.interceptors.response.use(
  (response: AxiosResponse<ResponseData>) => {
    const { data: result } = responseTypeCheck(response)
    if (result.code >= 200 && result.code < 300) {
      return response
    }
    return Promise.reject(new RequestError(result.code, result.msg, response))
  },
  (error: AxiosError) => {
    const { code, response } = error
    switch (code) {
      case 'ECONNABORTED':
        return Promise.reject(new RequestError(code, '请求超时', response))
      case 'ERR_NETWORK':
        return Promise.reject(new RequestError(code, '网络错误', response))
      case 'ERR_BAD_REQUEST':
        return Promise.reject(new RequestError(code, '请求错误', response))
      case 'ERR_BAD_RESPONSE':
        return Promise.reject(new RequestError(code, '响应错误', response))
      default:
        return Promise.reject(
          new RequestError('ERR_UNKNOWN', '未知错误', response)
        )
    }
  }
)

// 检查响应数据
const responseTypeCheck = (response: AxiosResponse<ResponseData>) => {
  const { data: responseData } = response
  const keys = Object.keys(responseData)
  const standardKeys = ['code', 'data', 'msg'] as const
  standardKeys.forEach((key) => {
    if (!keys.includes(key)) {
      throw new RequestError('ERR_TYPE_CHECK', '响应数据格式错误', response)
    }
  })

  return response
}

export class RequestError extends Error {
  code: string | number //服务端返回的自定义code或axios的错误code
  status?: number //http状态码
  response?: AxiosResponse

  constructor(code: string | number, msg: string, response?: AxiosResponse) {
    super(msg)
    this.code = code
    this.response = response
    this.status = response?.status
    this.name = 'RequestError'
  }
}

export const request = {
  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    const result: RequestResult<T> = {}

    try {
      const res = await instance.get<ResponseData<T>>(url, config)
      result.response = res.data
    } catch (err) {
      result.error = err as RequestError
    }

    return result
  },
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const result: RequestResult<T> = {}

    try {
      const res = await instance.post<ResponseData<T>>(url, data, config)
      result.response = res.data
    } catch (err) {
      if (err instanceof RequestError) {
        result.error = err
      }
    }

    return result
  }
}
