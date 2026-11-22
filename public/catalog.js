const subjects = g=>g<=5?["Toán","Tiếng Việt"]:g<=9?["Toán","Khoa học tự nhiên"]:["Vật lý"];
const topics=["Lí thuyết và bài tập theo bài","Bài tập luyện tập","Đề thi giữa học kì 1","Đề thi cuối học kì 1","Đề thi giữa học kì 2","Đề thi cuối học kì 2"];
const materials=["Tổng ôn kiến thức","Bài tập tự luyện","Đề thi thử"];
const tracks=["Theo chương trình","Thi vào lớp 10","Thi tốt nghiệp THPT","Kiểm tra định kì"];
function categories(track){return track===tracks[0]?topics:track===tracks[3]?["Kiểm tra định kì"]:materials}
function kind(track,category){if(track===tracks[3])return "periodic";return [...topics.slice(0,2),materials[1]].includes(category)?"exercise":"exam"}
if(typeof module!=="undefined")module.exports={subjects,topics,materials,tracks,categories,kind};
