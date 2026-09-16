import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "../../../lib/prisma";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../../../lib/contracts";

// POST /api/enroll — per PLAN.md item 5: never trust the client's word that
// a registerForCourse() transaction succeeded. Independently read
// getCourseRegistration() from the chain via our own server-side RPC
// provider (not the caller's), and only write the Enrollment cache row if
// the chain itself confirms the registration.
export async function POST(request: NextRequest) {
  let body: { courseId?: number; walletAddress?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { courseId, walletAddress, txHash } = body;
  if (
    typeof courseId !== "number" ||
    typeof walletAddress !== "string" ||
    typeof txHash !== "string" ||
    !ethers.utils.isAddress(walletAddress)
  ) {
    return NextResponse.json(
      { error: "courseId (number), walletAddress and txHash (strings) are required" },
      { status: 400 }
    );
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Unknown courseId" }, { status: 404 });
  }

  // ethers v5's JsonRpcProvider consistently failed with "could not detect
  // network" specifically inside Next.js's server runtime (Turbopack) —
  // confirmed the RPC endpoint itself and plain global fetch() both work
  // fine from the same route; only ethers' own internal HTTP layer failed.
  // Rather than depend on that, encode/decode the call via ethers'
  // (network-free, pure) ABI Interface and send it with plain fetch, which
  // is proven reliable in this environment.
  const iface = new ethers.utils.Interface(COURSE_REGISTRY_ABI);
  const callData = iface.encodeFunctionData("getCourseRegistration", [walletAddress, courseId]);

  let onChainTimestamp: ethers.BigNumber;
  try {
    const rpcRes = await fetch(process.env.SEPOLIA_RPC_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: COURSE_REGISTRY_ADDRESS, data: callData }, "latest"],
        id: 1,
      }),
    });
    const rpcJson = await rpcRes.json();
    if (rpcJson.error) throw new Error(rpcJson.error.message || "RPC error");
    [onChainTimestamp] = iface.decodeFunctionResult("getCourseRegistration", rpcJson.result);
  } catch (err) {
    console.error("Помилка читання getCourseRegistration():", err);
    return NextResponse.json({ error: "Failed to verify registration on-chain" }, { status: 502 });
  }

  if (onChainTimestamp.isZero()) {
    // The chain itself says this address is NOT registered for this course —
    // refuse to write the cache row no matter what the client claims.
    return NextResponse.json(
      { error: "On-chain registration not found for this address/courseId" },
      { status: 409 }
    );
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { courseId_walletAddress: { courseId, walletAddress } },
    update: { txHash },
    create: { courseId, walletAddress, txHash },
  });

  return NextResponse.json({ enrollment }, { status: 200 });
}
