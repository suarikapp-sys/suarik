export default function Loading() {
  return (
    <div style={{
      display:"flex",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"#060606",
      fontFamily:"'Geist',system-ui,sans-serif",
    }}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"16px"}}>
        <div style={{
          width:"32px",height:"32px",borderRadius:"50%",
          border:"2px solid #131313",borderTopColor:"#E8512A",
          animation:"spin 0.8s linear infinite",
        }}/>
        <span style={{fontSize:"12px",color:"#444",letterSpacing:"0.06em"}}>
          Carregando...
        </span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
