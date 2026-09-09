import { request } from './request'
import type {
  BookingPlan,
  CampusStatus,
  LibraryBuilding,
  LibraryRoom,
  Seat
} from './types'

// 校园服务：武大统一身份认证（CAS）绑定。
// 密码仅用于本次换取 CAS 会话，后端不存储、不记录。

export function bindCas(username: string, password: string) {
  return request<null>({
    url: '/api/v1/campus/cas/bind',
    method: 'POST',
    data: { username, password }
  })
}

export function getCasStatus() {
  return request<CampusStatus>({ url: '/api/v1/campus/cas/status' })
}

export function unbindCas() {
  return request<null>({
    url: '/api/v1/campus/cas/unbind',
    method: 'POST'
  })
}

// 图书馆座位（只读查询）
export function getLibraryBuildings() {
  return request<LibraryBuilding[]>({ url: '/api/v1/campus/library/buildings' })
}

export function getLibraryRooms(building: string) {
  return request<LibraryRoom[]>({ url: '/api/v1/campus/library/rooms', data: { building } })
}

export function getLibrarySeats(room: string, date: string) {
  return request<Seat[]>({ url: '/api/v1/campus/library/seats', data: { room, date } })
}

// 图书馆定时自动预约计划
export interface CreateBookingPlanPayload {
  room_id: string
  seat_id: string
  room_name: string
  seat_name: string
  date: string
  start_time: string
  end_time: string
  book_at: string
}

export function listBookingPlans() {
  return request<BookingPlan[]>({ url: '/api/v1/campus/library/plan' })
}

export function createBookingPlan(payload: CreateBookingPlanPayload) {
  return request<BookingPlan>({
    url: '/api/v1/campus/library/plan',
    method: 'POST',
    data: payload
  })
}

export function deleteBookingPlan(id: string) {
  return request<null>({
    url: `/api/v1/campus/library/plan/${id}`,
    method: 'DELETE'
  })
}
