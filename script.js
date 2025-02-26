// Initialize ml5 model for phosphorus detection
let model;
let modelLoaded = false;
let classLabels = []; // เก็บรายชื่อของ class ทั้งหมดจากโมเดล

// Load the model from Teachable Machine URL
function loadModel() {
    $('#modelStatus').html('<span class="loading">กำลังโหลดโมเดล... กรุณารอสักครู่</span>');
    try {
        // แก้ไข URL ให้ตรงกับโมเดล Teachable Machine ที่ถูกต้อง
        const modelURL = 'https://teachablemachine.withgoogle.com/models/sLGlkK9fc/';
        model = ml5.imageClassifier(modelURL + 'model.json', modelReady);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการโหลดโมเดล:", error);
        $('#modelStatus').html('<span class="error">เกิดข้อผิดพลาดในการโหลดโมเดล: ' + error.message + '</span>');
    }
}

// ฟังก์ชั่นที่จะทำงานเมื่อโมเดลโหลดเสร็จแล้ว
function modelReady() {
    console.log("โมเดลโหลดเรียบร้อยแล้ว!");
    
    // พยายามดึงข้อมูลเกี่ยวกับ classes ที่โมเดลรู้จัก
    try {
        if (model.model && model.model.outputNode) {
            // ในบางกรณี ml5 จะเก็บชื่อคลาสไว้ที่นี่
            classLabels = model.model.outputNode.outputNames || [];
            console.log("พบ class labels จากโมเดล:", classLabels);
        } else if (model.model && model.model.modelLabels) {
            // หรืออาจเก็บไว้ที่นี่
            classLabels = model.model.modelLabels;
            console.log("พบ model labels จากโมเดล:", classLabels);
        }
    } catch (e) {
        console.warn("ไม่สามารถดึง class labels จากโมเดลได้:", e);
    }
    
    modelLoaded = true;
    $('#modelStatus').html('<span class="success">โหลดโมเดลเรียบร้อย! พร้อมวิเคราะห์ภาพแล้ว</span>');
}

// แปลงรูปแบบผลลัพธ์ที่ได้จากโมเดลให้เป็นค่าที่ถูกต้อง
function parsePhosphorusResult(label) {
    // ลองหลายรูปแบบที่อาจเป็นไปได้
    
    // รูปแบบ: "ฟอสฟอรัสต่ำ (0-15 ppm)" หรือคล้ายๆกัน
    const ppmPattern = /(\d+)-(\d+)\s*ppm/i;
    const ppmMatch = label.match(ppmPattern);
    if (ppmMatch) {
        const minValue = parseInt(ppmMatch[1]);
        const maxValue = parseInt(ppmMatch[2]);
        const avgValue = (minValue + maxValue) / 2;
        return {
            label: label,
            value: avgValue,
            unit: 'ppm',
            rangeMin: minValue,
            rangeMax: maxValue
        };
    }
    
    // รูปแบบ: "ค่าฟอสฟอรัส: 25%" หรือ "25%"
    const percentPattern = /(\d+(?:\.\d+)?)\s*%/;
    const percentMatch = label.match(percentPattern);
    if (percentMatch) {
        return {
            label: label,
            value: parseFloat(percentMatch[1]),
            unit: '%'
        };
    }
    
    // ถ้าเป็นตัวเลขล้วนๆ
    const numericPattern = /^(\d+(?:\.\d+)?)$/;
    const numericMatch = label.match(numericPattern);
    if (numericMatch) {
        return {
            label: label,
            value: parseFloat(numericMatch[1]),
            unit: ''
        };
    }
    
    // ถ้าไม่ตรงกับรูปแบบใดๆ ส่งคืนค่าเดิม
    return {
        label: label,
        value: null,
        unit: '',
        isRaw: true
    };
}

// ปรับขนาดและคุณภาพของภาพก่อนวิเคราะห์
function preprocessImage(originalImage) {
    return new Promise((resolve, reject) => {
        try {
            // สร้าง image element
            const img = new Image();
            img.onload = function() {
                // สร้าง canvas สำหรับปรับแต่งภาพ
                const canvas = document.createElement('canvas');
                
                // ปรับขนาดภาพให้พอดีกับขนาดที่โมเดลต้องการ (224x224 หรือตามที่โมเดลถูกฝึกมา)
                const size = 224;
                canvas.width = size;
                canvas.height = size;
                
                const ctx = canvas.getContext('2d');
                
                // วาดภาพบน canvas พร้อมปรับขนาด
                ctx.drawImage(img, 0, 0, size, size);
                
                // ส่งภาพที่ปรับแต่งแล้วกลับไป
                resolve(canvas);
            };
            
            img.onerror = function(error) {
                reject("เกิดข้อผิดพลาดในการโหลดภาพ: " + error);
            };
            
            img.src = originalImage;
        } catch (error) {
            reject("เกิดข้อผิดพลาดในการประมวลผลภาพ: " + error.message);
        }
    });
}

// Process the uploaded or captured image
async function processImage(image) {
    if (!modelLoaded) {
        $('#phosphorus').html('<span class="error">โมเดลยังไม่ได้โหลด กรุณารอและลองใหม่อีกครั้ง</span>');
        return;
    }

    $('#phosphorus').html('<span class="loading">กำลังวิเคราะห์ภาพ... กรุณารอสักครู่</span>');
    $('#rawResults').html('<span class="loading">กำลังประมวลผล...</span>');
    
    try {
        // ปรับแต่งภาพก่อนส่งไปยังโมเดล
        const processedImg = await preprocessImage(image);
        
        // วิเคราะห์ภาพด้วยโมเดล
        model.classify(processedImg, gotResults);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการประมวลผลภาพ:", error);
        $('#phosphorus').html('<span class="error">เกิดข้อผิดพลาดในการประมวลผลภาพ: ' + error + '</span>');
        $('#rawResults').html('<span class="error">เกิดข้อผิดพลาดในการประมวลผล: ' + error + '</span>');
    }
}

// ฟังก์ชั่นที่จะรันเมื่อได้ผลลัพธ์จากโมเดล
function gotResults(err, results) {
    if (err) {
        console.error("เกิดข้อผิดพลาดในการวิเคราะห์:", err);
        $('#phosphorus').html('<span class="error">เกิดข้อผิดพลาดในการวิเคราะห์ภาพ: ' + err + '</span>');
        return;
    }
    
    // แสดงข้อมูลดิบที่ได้จากโมเดลเพื่อการ debug
    console.log("ผลลัพธ์การวิเคราะห์:", results);
    $('#rawResults').html('<span class="debug">ข้อมูลดิบ: ' + JSON.stringify(results) + '</span>');
    
    if (results && results.length > 0) {
        // ดึงข้อมูลจากผลลัพธ์อันดับแรก (ที่มีความมั่นใจสูงสุด)
        let topResult = results[0];
        let topLabel = topResult.label;
        let topConfidence = topResult.confidence * 100;
        
        // แปลงผลลัพธ์อันดับแรกให้อยู่ในรูปแบบที่ถูกต้อง
        let parsedTopResult = parsePhosphorusResult(topLabel);
        
        // สร้าง HTML สำหรับแสดงผล
        let resultHTML = '<div class="result-container">';
        resultHTML += '<div class="success result-label" style="font-size: 28px;">' + parsedTopResult.label + '</div>';
        
        // ถ้ามีค่าตัวเลข แสดงในรูปแบบที่อ่านง่าย
        if (parsedTopResult.value !== null) {
            resultHTML += '<div class="value-display">' + parsedTopResult.value.toFixed(1) + ' ' + parsedTopResult.unit + '</div>';
        }
        
        // แสดงความมั่นใจของโมเดลสำหรับอันดับแรก
        resultHTML += '<div style="margin-top: 10px; font-size: 20px;">ความมั่นใจ: ' + 
            topConfidence.toFixed(2) + '%</div>';
            
        // แสดงคำแนะนำขึ้นอยู่กับระดับฟอสฟอรัส
        resultHTML += '<div class="recommendation">';

        if (parsedTopResult.label.toLowerCase().includes("มาก") || 
            (parsedTopResult.value !== null && parsedTopResult.value > 60)) {
            resultHTML += 'มีธาตุไนโตรเจนมาก <br> คำแนะนำ: ธาตุไนโตรเจนเพียงพอแล้ว ไม่จำเป็นต้องใส่ปุ๋ย';
        } 
        else if (parsedTopResult.label.toLowerCase().includes("กลาง") || 
                 (parsedTopResult.value !== null && parsedTopResult.value >= 20 && parsedTopResult.value <= 60)) {
            resultHTML += 'มีธาตุไนโตรเจนกลาง <br> คำแนะนำ: มีธาตุไนโตรเจนระดับปานกลาง ควรใส่ปุ๋ยเพิ่มเล็กน้อย';
        } 
        else {
            resultHTML += 'มีธาตุไนโตรเจนน้อยหรือไม่มีธาตุไนโตรเจน <br> คำแนะนำ: ควรเพิ่มปุ๋ยไนโตรเจนให้กับดิน';
        }
        
        resultHTML += '</div>';
        
        
        // เพิ่มส่วนแสดงการทำนายทั้งหมดทุกระดับ
        resultHTML += '<div class="all-predictions">';
        resultHTML += '<h4 style="margin-top: 20px; font-weight: bold;">การทำนายทั้งหมด:</h4>';
        resultHTML += '<div class="predictions-grid">';
        
        // วนลูปแสดงผลทุกระดับ
        for (let i = 0; i < results.length; i++) {
            const prediction = results[i];
            const confidence = prediction.confidence * 100;
            const label = prediction.label;
            
            // กำหนดสีตามความมั่นใจ
            let confidenceClass = "";
            if (confidence > 75) {
                confidenceClass = "high-confidence";
            } else if (confidence > 25) {
                confidenceClass = "medium-confidence";
            } else {
                confidenceClass = "low-confidence";
            }
            
            resultHTML += '<div class="prediction-item ' + confidenceClass + '">';
            resultHTML += '<div class="prediction-label">' + label + '</div>';
            resultHTML += '<div class="prediction-bar-container">';
            resultHTML += '<div class="prediction-bar" style="width: ' + confidence.toFixed(1) + '%"></div>';
            resultHTML += '<span class="prediction-percentage">' + confidence.toFixed(1) + '%</span>';
            resultHTML += '</div>';
            resultHTML += '</div>';
        }
        
        resultHTML += '</div>'; // ปิด predictions-grid
        resultHTML += '</div>'; // ปิด all-predictions
        
        resultHTML += '</div>'; // ปิด result-container
        
        $('#phosphorus').html(resultHTML);
        
        // เพิ่ม CSS สำหรับส่วนแสดงผลเพิ่มเติม
        const additionalStyle = `
            <style>
                .all-predictions {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #f1f8e9;
                    border-radius: 8px;
                }
                
                .predictions-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .prediction-item {
                    display: flex;
                    flex-direction: column;
                    padding: 8px;
                    border-radius: 6px;
                    background-color: white;
                }
                
                .prediction-label {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .prediction-bar-container {
                    position: relative;
                    height: 25px;
                    background-color: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .prediction-bar {
                    height: 100%;
                    background-color: #4CAF50;
                    transition: width 0.5s ease;
                }
                
                .prediction-percentage {
                    position: absolute;
                    right: 10px;
                    top: 0;
                    line-height: 25px;
                    color: #000;
                    font-weight: bold;
                    text-shadow: 0px 0px 2px white;
                }
                
                .high-confidence .prediction-bar {
                    background-color: #4CAF50;
                }
                
                .medium-confidence .prediction-bar {
                    background-color: #FFC107;
                }
                
                .low-confidence .prediction-bar {
                    background-color: #9E9E9E;
                }
            </style>
        `;
        
        // เพิ่ม CSS เพิ่มเติมเข้าไปในหน้า
        if (!$('#additional-prediction-styles').length) {
            $('head').append('<div id="additional-prediction-styles">' + additionalStyle + '</div>');
        } else {
            $('#additional-prediction-styles').html(additionalStyle);
        }
        
    } else {
        $('#phosphorus').html('<span class="error">ไม่มีผลลัพธ์จากโมเดล</span>');
    }
}

// Event Handlers
$(document).ready(function () {
    console.log("เริ่มต้นแอปพลิเคชัน...");
    $('#phosphorus').html('<span>รอการวิเคราะห์ภาพ...</span>');
    
    // เพิ่มพื้นที่สำหรับแสดงข้อมูลดิบ
    $('<div class="status-container debug-container"><span id="rawResults">ข้อมูลดิบจะแสดงที่นี่เพื่อการตรวจสอบ</span></div>')
        .insertAfter($('#phosphorus').parent());
    
    loadModel();
    
    // Start the camera to capture video
    $('#startCamera').click(function () {
        $('#modelStatus').html('<span class="loading">กำลังเริ่มกล้อง...</span>');
        
        // ขอสิทธิ์การใช้กล้อง กำหนดความละเอียดให้เหมาะสม
        const constraints = { 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'environment' // ใช้กล้องหลังในมือถือ
            } 
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                let videoElement = document.getElementById('video');
                videoElement.srcObject = stream;
                $('#modelStatus').html('<span class="success">เริ่มใช้งานกล้องเรียบร้อย!</span>');
            })
            .catch(function (error) {
                console.error("เกิดข้อผิดพลาดในการเข้าถึงกล้อง:", error);
                $('#modelStatus').html('<span class="error">เกิดข้อผิดพลาดในการเข้าถึงกล้อง: ' + error.message + '</span>');
            });
    });

    // Capture the current frame from the video stream
    $('#captureImage').click(function () {
        try {
            let videoElement = document.getElementById('video');
            
            if (!videoElement.srcObject) {
                alert("กรุณาเปิดกล้องก่อน");
                return;
            }
            
            $('#modelStatus').html('<span class="loading">กำลังบันทึกภาพ...</span>');
            
            let canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            let imageData = canvas.toDataURL('image/jpeg', 0.9); // ใช้คุณภาพ 90%
            
            document.getElementById('capturedImg').src = imageData;
            $('#modelStatus').html('<span class="success">บันทึกภาพเรียบร้อย!</span>');
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการบันทึกภาพ:", error);
            $('#modelStatus').html('<span class="error">เกิดข้อผิดพลาดในการบันทึกภาพ: ' + error.message + '</span>');
        }
    });

    // Show results button
    $('#show').click(function() {
        let imgSrc = document.getElementById('capturedImg').src;
        if (imgSrc && imgSrc !== '') {
            processImage(imgSrc);
        } else {
            alert("กรุณาถ่ายภาพหรืออัปโหลดภาพก่อน");
            $('#phosphorus').html('<span class="error">ไม่มีภาพสำหรับวิเคราะห์</span>');
        }
    });

    // Image upload handler
    $('#imageUpload').change(function(event) {
        try {
            let file = event.target.files[0];
            if (!file) return;
            
            $('#modelStatus').html('<span class="loading">กำลังโหลดภาพที่อัปโหลด...</span>');
            
            // ตรวจสอบประเภทไฟล์
            if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
                alert("กรุณาอัปโหลดไฟล์ภาพ JPG หรือ PNG เท่านั้น");
                $('#modelStatus').html('<span class="error">ไฟล์ไม่ถูกต้อง โปรดใช้ไฟล์ JPG หรือ PNG</span>');
                return;
            }
            
            // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert("ขนาดไฟล์ใหญ่เกินไป กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 5MB");
                $('#modelStatus').html('<span class="error">ไฟล์ขนาดใหญ่เกินไป</span>');
                return;
            }
            
            let reader = new FileReader();
            reader.onload = function(e) {
                let image = e.target.result;
                $('#capturedImg').attr('src', image);
                $('#modelStatus').html('<span class="success">อัปโหลดภาพเรียบร้อย!</span>');
            };
            
            reader.onerror = function(error) {
                console.error("เกิดข้อผิดพลาดในการอ่านไฟล์:", error);
                $('#modelStatus').html('<span class="error">เกิดข้อผิดพลาดในการอ่านไฟล์: ' + error + '</span>');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการจัดการไฟล์อัปโหลด:", error);
            $('#modelStatus').html('<span class="error">เกิดข้อผิดพลาดในการจัดการไฟล์อัปโหลด: ' + error.message + '</span>');
        }
    });
});