const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const decimals = await prisma.order.findFirst();
  if (decimals && decimals.total) {
    console.log("total is:", decimals.total);
    console.log("type of total:", typeof decimals.total);
    console.log("Number(total):", Number(decimals.total));
    console.log("isNaN?", isNaN(Number(decimals.total)));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
