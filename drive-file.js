function driveFile(input) {
 let url;
 try { url = new URL(input); } catch {}
 if (!url || url.origin !== "https://drive.google.com") throw Object.assign(Error("Dán liên kết chia sẻ tệp từ Google Drive."),{status:400});
 const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || url.searchParams.get("id");
 if (!id || !/^[\w-]{8,180}$/.test(id)) throw Object.assign(Error("Liên kết cần trỏ đến một tệp trên Drive."),{status:400});
 const resource = url.searchParams.get("resourcekey");
 const query = resource ? "?resourcekey="+encodeURIComponent(resource) : "";
 return {id,resource,preview:"https://drive.google.com/file/d/"+id+"/preview"+query,view:"https://drive.google.com/file/d/"+id+"/view"+query};
}
if(typeof module!=="undefined") module.exports={driveFile};
