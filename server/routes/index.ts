import express from "express"

const router = express.Router()

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({
    "status": 200,
    "message": "Server is working"
  })
});

export default router
