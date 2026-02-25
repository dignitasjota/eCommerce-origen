const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const orderId = 'ord-001'
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      users: true,
      shipping_methods: { include: { shipping_method_translations: { where: { locale: 'es' } } } },
      addresses_orders_shipping_address_idToaddresses: true,
      order_items: { include: { products: true, product_variants: true } }
    }
  })

  if (!order) {
    console.log("Not found by ID, trying by order_number")
    order = await prisma.order.findUnique({
      where: { order_number: 'ord-001' },
      include: {
        users: true,
        shipping_methods: { include: { shipping_method_translations: { where: { locale: 'es' } } } },
        addresses_orders_shipping_address_idToaddresses: true,
        order_items: { include: { products: true, product_variants: true } }
      }
    })
  }

  console.log(JSON.stringify(order, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
