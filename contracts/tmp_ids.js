(async()=>{const r=await fetch('http://backend:8080/api/campaigns'); const d=await r.json(); const ids=(Array.isArray(d)?d:[]).map(c=>c.id).join(','); console.log(ids);})();
