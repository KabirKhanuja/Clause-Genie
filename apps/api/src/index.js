import express from "express";
const app = express();
app.use(express.json());
app.get("/health", (_,res)=>res.json({ok:true}));
app.post("/upload", (_,res)=>res.json({ok:true}));
const port = process.env.PORT || 3001;
app.listen(port, ()=>console.log(`API running on ${port}`));