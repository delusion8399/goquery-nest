import { Injectable } from "@nestjs/common";
import { RequestInfo, RequestInit, Response } from "node-fetch";

@Injectable()
export class EnvoyService {
  fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
    return import("node-fetch").then(({ default: fetch }) => fetch(url, init));
  }
}
