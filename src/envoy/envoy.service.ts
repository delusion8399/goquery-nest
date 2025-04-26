import { Injectable } from "@nestjs/common";
import fetch, { RequestInfo, RequestInit, Response } from "node-fetch";

@Injectable()
export class EnvoyService {
  async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}
