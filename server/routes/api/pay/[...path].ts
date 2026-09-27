import { handlePayRequest } from "../../../pay/handle";

type PayEvent = {
  req: Request;
  url?: URL;
};

export default async function payRoute(event: PayEvent) {
  const request = event.req;
  if (request instanceof Request) return handlePayRequest(request);
  const url = event.url?.toString() ?? "http://localhost/api/pay";
  return handlePayRequest(new Request(url));
}
