import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backendProxy";

export const maxDuration = 70;

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  return proxyBackendRequest(req, path, "recruit-public");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}