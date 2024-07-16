import { WebSocket } from "ws"

export interface ExtWebSocket extends WebSocket{
userId:string
}