import { createClient } from "redis";

const getRedis = async () => {
  const client = createClient({
    url: process.env.REDIS_URL,
  })

  client.on("error", function (error) {
    console.error(error)
  })

  client.on("connect", function () {
    console.log("Redis client connected")
  })


  await client.connect();
  return client;
}

export default getRedis;