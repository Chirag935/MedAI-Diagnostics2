'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import jsPDF from 'jspdf'



interface PredictionRecord {
  disease: string
  prediction: string
  confidence: number
  riskLevel: string
  timestamp: string
  explanation?: string
  details?: Record<string, any>
  inputs?: Record<string, any>
}

interface EnhancedPDFExportProps {
  predictions: PredictionRecord[]
  patientName?: string
  patientId?: string
}

export default function EnhancedPDFExport({ 
  predictions, 
  patientName = 'Patient',
  patientId = 'N/A'
}: EnhancedPDFExportProps) {
  const { addToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)


  // Disease-specific comprehensive analysis
  const getDiseaseAnalysis = (disease: string, riskLevel: string, confidence: number, inputs?: Record<string, any>) => {
    const analyses: Record<string, Record<string, { summary: string, riskFactors: string[], recommendations: string[] }>> = {
      'Diabetes': {
        'LOW': {
          summary: 'Your diabetes risk is currently low. Your metabolic indicators are within healthy ranges.',
          riskFactors: ['Age over 45', 'Family history', 'Sedentary lifestyle', 'BMI over 25'],
          recommendations: ['Continue regular exercise', 'Maintain healthy BMI', 'Annual glucose screening', 'Balanced diet']
        },
        'MODERATE': {
          summary: 'You show moderate risk for diabetes. Some metabolic markers are elevated and require attention.',
          riskFactors: ['Elevated glucose levels', 'Insulin resistance indicators', 'Weight gain pattern', 'Lifestyle factors'],
          recommendations: ['Consult endocrinologist', 'Regular glucose monitoring', 'Weight management program', 'Dietary modifications']
        },
        'HIGH': {
          summary: 'High diabetes risk detected. Multiple indicators suggest prediabetes or diabetes onset.',
          riskFactors: ['Significantly elevated glucose', 'Multiple risk factors present', 'Metabolic syndrome indicators', 'Family history + lifestyle'],
          recommendations: ['Immediate physician consultation', 'Comprehensive metabolic panel', 'Diabetes education program', 'Lifestyle intervention']
        },
        'CRITICAL': {
          summary: 'Critical diabetes risk. Immediate medical intervention strongly advised.',
          riskFactors: ['Severely elevated glucose', 'Diabetic symptoms present', 'Organ stress indicators', 'Urgent intervention needed'],
          recommendations: ['Emergency medical consultation', 'Immediate glucose management', 'Specialist referral', 'Comprehensive treatment plan']
        }
      },
      'Heart Disease': {
        'LOW': {
          summary: 'Your cardiovascular risk profile is favorable. Heart health indicators are normal.',
          riskFactors: ['Age', 'Gender', 'Family history'],
          recommendations: ['Continue healthy lifestyle', 'Regular cardio exercise', 'Stress management', 'Annual checkups']
        },
        'MODERATE': {
          summary: 'Moderate cardiovascular risk detected. Some heart disease risk factors are present.',
          riskFactors: ['Elevated cholesterol', 'Blood pressure concerns', 'Lifestyle factors', 'Weight issues'],
          recommendations: ['Cardiologist consultation', 'Lipid panel monitoring', 'Blood pressure management', 'Exercise program']
        },
        'HIGH': {
          summary: 'High cardiovascular risk. Multiple cardiac risk indicators are elevated.',
          riskFactors: ['Multiple risk factors', 'Significant cholesterol elevation', 'Hypertension indicators', 'Family history + lifestyle'],
          recommendations: ['Immediate cardiology referral', 'Comprehensive cardiac workup', 'Medication evaluation', 'Intensive lifestyle changes']
        },
        'CRITICAL': {
          summary: 'Critical cardiovascular risk. Immediate cardiac evaluation and intervention required.',
          riskFactors: ['Severe risk factor combination', 'Cardiac symptoms indicators', 'Organ stress signs', 'Emergency intervention needed'],
          recommendations: ['Emergency cardiology consultation', 'Immediate intervention', 'Comprehensive cardiac care', 'Critical monitoring']
        }
      },
      'Pneumonia': {
        'LOW': {
          summary: 'Chest X-ray analysis shows normal lung tissue. No significant pneumonia indicators detected.',
          riskFactors: ['Recent respiratory infection', 'Immunocompromised status', 'Chronic lung disease', 'Age extremes'],
          recommendations: ['Continue monitoring symptoms', 'Rest and hydration', 'Follow-up if symptoms worsen', 'Preventive care']
        },
        'MODERATE': {
          summary: 'Mild pneumonia indicators detected. Some consolidation or inflammation visible in lung tissue.',
          riskFactors: ['Bacterial infection present', 'Immune response activated', 'Respiratory compromise', 'Vulnerable patient status'],
          recommendations: ['Antibiotic therapy', 'Rest and fluids', 'Follow-up imaging', 'Symptom monitoring']
        },
        'HIGH': {
          summary: 'Significant pneumonia indicators detected. Substantial lung consolidation or inflammation present.',
          riskFactors: ['Active bacterial/viral infection', 'Significant lung involvement', 'Respiratory distress', 'Systemic infection signs'],
          recommendations: ['Immediate medical care', 'Hospitalization assessment', 'IV antibiotics', 'Respiratory support']
        },
        'CRITICAL': {
          summary: 'Severe pneumonia detected. Extensive lung involvement requiring urgent medical intervention.',
          riskFactors: ['Severe lung consolidation', 'Respiratory failure risk', 'Systemic sepsis signs', 'Critical condition'],
          recommendations: ['Emergency care immediately', 'Hospitalization required', 'Intensive treatment', 'Critical care monitoring']
        }
      },
      'Malaria': {
        'LOW': {
          summary: 'Blood smear analysis shows no malaria parasites. Blood cells appear normal.',
          riskFactors: ['Travel to endemic areas', 'Mosquito exposure', 'No prophylaxis', 'Seasonal factors'],
          recommendations: ['Continue prophylaxis if applicable', 'Monitor for symptoms', 'Preventive measures', 'Follow-up if exposure continues']
        },
        'MODERATE': {
          summary: 'Malaria parasites detected in blood smear. Moderate parasitemia level observed.',
          riskFactors: ['Active Plasmodium infection', 'Parasite load present', 'Immune response active', 'Exposure history confirmed'],
          recommendations: ['Antimalarial treatment', 'Blood count monitoring', 'Complete medication course', 'Follow-up testing']
        },
        'HIGH': {
          summary: 'Significant malaria infection detected. High parasitemia with potential complications.',
          riskFactors: ['High parasite density', 'Complicated malaria risk', 'Organ involvement', 'Severe symptoms'],
          recommendations: ['Hospitalization required', 'IV antimalarials', 'Intensive monitoring', 'Organ function assessment']
        },
        'CRITICAL': {
          summary: 'Severe malaria detected. Life-threatening parasitemia requiring immediate intervention.',
          riskFactors: ['Severe parasitemia', 'Cerebral malaria risk', 'Multi-organ involvement', 'Hemodynamic instability'],
          recommendations: ['Emergency hospitalization', 'ICU care', 'Blood exchange transfusion', 'Critical care management']
        }
      },
      'Breast Cancer': {
        'LOW': {
          summary: 'Clinical indicators show low malignancy risk. Features suggest benign characteristics.',
          riskFactors: ['Age over 40', 'Family history', 'Hormonal factors', 'Lifestyle factors'],
          recommendations: ['Continue screening', 'Monthly self-exams', 'Annual mammograms', 'Healthy lifestyle']
        },
        'MODERATE': {
          summary: 'Moderate malignancy risk detected. Some features warrant further investigation.',
          riskFactors: ['Suspicious features present', 'Family history significance', 'Cellular atypia indicators', 'Hormonal risk factors'],
          recommendations: ['Imaging follow-up', 'Oncology consultation', 'Biopsy consideration', 'Enhanced surveillance']
        },
        'HIGH': {
          summary: 'High malignancy risk detected. Multiple features suggest malignant characteristics.',
          riskFactors: ['Malignant features present', 'Multiple suspicious indicators', 'Cellular abnormality', 'Aggressive pattern signs'],
          recommendations: ['Immediate biopsy', 'Oncology referral', 'Staging workup', 'Treatment planning']
        },
        'CRITICAL': {
          summary: 'Critical malignancy indicators. Extensive suspicious features requiring urgent intervention.',
          riskFactors: ['Severe malignant features', 'Advanced indicators', 'Multiple risk factors', 'Urgent intervention needed'],
          recommendations: ['Emergency oncology referral', 'Immediate diagnostic workup', 'Comprehensive treatment plan', 'Support team activation']
        }
      },
      'Kidney Disease': {
        'LOW': {
          summary: 'Renal function indicators are within normal ranges. Kidney health appears stable.',
          riskFactors: ['Age', 'Hypertension', 'Diabetes', 'Family history'],
          recommendations: ['Annual kidney screening', 'Blood pressure control', 'Diabetes management', 'Hydration']
        },
        'MODERATE': {
          summary: 'Moderate kidney disease risk. Some renal function markers are elevated.',
          riskFactors: ['Elevated creatinine', 'Reduced GFR', 'Proteinuria indicators', 'Risk factor combination'],
          recommendations: ['Nephrology consultation', 'Kidney function monitoring', 'Blood pressure management', 'Dietary modifications']
        },
        'HIGH': {
          summary: 'High kidney disease risk. Significant renal function impairment indicators present.',
          riskFactors: ['Significant GFR reduction', 'Advanced proteinuria', 'Multiple risk factors', 'Comorbid conditions'],
          recommendations: ['Immediate nephrology referral', 'Comprehensive kidney workup', 'Treatment initiation', 'Regular monitoring']
        },
        'CRITICAL': {
          summary: 'Critical kidney disease indicators. Severe renal impairment requiring urgent care.',
          riskFactors: ['Severe renal dysfunction', 'Kidney failure risk', 'Multiple complications', 'Emergency intervention needed'],
          recommendations: ['Emergency nephrology care', 'Dialysis evaluation', 'Transplant assessment', 'Intensive management']
        }
      },
      'Liver Disease': {
        'LOW': {
          summary: 'Liver function indicators are within normal ranges. Hepatic health appears stable.',
          riskFactors: ['Alcohol use', 'Hepatitis history', 'Medications', 'Metabolic factors'],
          recommendations: ['Regular liver screening', 'Avoid hepatotoxic substances', 'Vaccinations', 'Healthy diet']
        },
        'MODERATE': {
          summary: 'Moderate liver disease risk. Some hepatic function markers are elevated.',
          riskFactors: ['Elevated enzymes', 'Fatty liver indicators', 'Inflammation markers', 'Risk factor presence'],
          recommendations: ['Hepatology consultation', 'Liver function monitoring', 'Lifestyle modifications', 'Medication review']
        },
        'HIGH': {
          summary: 'High liver disease risk. Significant hepatic impairment indicators present.',
          riskFactors: ['Significant enzyme elevation', 'Advanced liver damage', 'Cirrhosis indicators', 'Multiple risk factors'],
          recommendations: ['Immediate hepatology referral', 'Comprehensive liver workup', 'Treatment initiation', 'Monitoring protocol']
        },
        'CRITICAL': {
          summary: 'Critical liver disease indicators. Severe hepatic impairment requiring urgent care.',
          riskFactors: ['Severe liver dysfunction', 'Liver failure risk', 'Complications present', 'Emergency intervention needed'],
          recommendations: ['Emergency hepatology care', 'Hospitalization assessment', 'Transplant evaluation', 'Intensive management']
        }
      },
      'Alzheimer': {
        'LOW': {
          summary: 'Cognitive indicators are within normal ranges. No significant dementia markers detected.',
          riskFactors: ['Age', 'Family history', 'Genetic factors', 'Cardiovascular health'],
          recommendations: ['Cognitive exercises', 'Social engagement', 'Cardiovascular health', 'Regular monitoring']
        },
        'MODERATE': {
          summary: 'Moderate cognitive decline indicators. Some markers suggest early dementia changes.',
          riskFactors: ['Mild cognitive impairment', 'Memory concerns', 'Functional changes', 'Risk factor combination'],
          recommendations: ['Neurology consultation', 'Cognitive assessment', 'Caregiver education', 'Safety planning']
        },
        'HIGH': {
          summary: 'Significant cognitive decline indicators. Multiple markers suggest dementia progression.',
          riskFactors: ['Significant memory impairment', 'Functional decline', 'Behavioral changes', 'Advanced progression'],
          recommendations: ['Immediate neurology referral', 'Comprehensive evaluation', 'Treatment planning', 'Care support']
        },
        'CRITICAL': {
          summary: 'Severe cognitive decline indicators. Advanced dementia markers requiring urgent care.',
          riskFactors: ['Severe cognitive impairment', 'Functional dependence', 'Safety concerns', 'Advanced care needs'],
          recommendations: ['Emergency neurology care', 'Full-time support planning', 'Advanced directives', 'Palliative support']
        }
      }
    }
    
    return analyses[disease]?.[riskLevel] || {
      summary: `Risk level assessment for ${disease} shows ${riskLevel.toLowerCase()} risk classification.`,
      riskFactors: ['Individual risk factors present', 'Clinical indicators', 'Lifestyle factors'],
      recommendations: ['Consult healthcare provider', 'Regular monitoring', 'Follow medical advice']
    }
  }

  const getPrecautionaryMeasures = (disease: string, riskLevel: string): string[] => {
    const measures: Record<string, Record<string, string[]>> = {
      'Diabetes': {
        'LOW': ['Maintain healthy diet', 'Regular exercise', 'Annual checkups'],
        'MODERATE': ['Reduce sugar intake', 'Exercise 30 min daily', 'Monitor blood glucose', 'Consult doctor'],
        'HIGH': ['Strict diet control', 'Daily glucose monitoring', 'Immediate doctor consultation', 'Consider medication'],
        'CRITICAL': ['Urgent medical attention', 'Strict glucose monitoring', 'Follow specialist advice', 'Lifestyle overhaul']
      },
      'Heart Disease': {
        'LOW': ['Regular exercise', 'Balanced diet', 'Stress management'],
        'MODERATE': ['Reduce salt intake', 'Regular cardio exercise', 'Monitor blood pressure', 'Schedule checkup'],
        'HIGH': ['Low-sodium diet', 'Daily blood pressure monitoring', 'Avoid strenuous activity', 'See cardiologist'],
        'CRITICAL': ['Immediate medical care', 'Complete bed rest', 'Emergency consultation', 'Strict medication adherence']
      },
      'Breast Cancer': {
        'LOW': ['Monthly self-exams', 'Annual mammograms', 'Healthy lifestyle'],
        'MODERATE': ['Immediate imaging', 'Consult oncologist', 'Genetic counseling', 'Regular monitoring'],
        'HIGH': ['Urgent biopsy', 'Specialist consultation', 'Treatment planning', 'Second opinion'],
        'CRITICAL': ['Immediate oncologist referral', 'Comprehensive staging', 'Begin treatment protocol', 'Support team']
      },
      'Kidney Disease': {
        'LOW': ['Stay hydrated', 'Monitor blood pressure', 'Regular blood tests'],
        'MODERATE': ['Reduce protein intake', 'Monitor creatinine levels', 'Blood pressure control', 'Nephrologist visit'],
        'HIGH': ['Strict diet restrictions', 'Regular dialysis prep', 'Medication management', 'Frequent monitoring'],
        'CRITICAL': ['Immediate nephrology care', 'Dialysis evaluation', 'Transplant assessment', 'Intensive management']
      },
      'Liver Disease': {
        'LOW': ['Avoid alcohol', 'Healthy diet', 'Regular liver function tests'],
        'MODERATE': ['Complete alcohol abstinence', 'Low-fat diet', 'Hepatology consultation', 'Medication review'],
        'HIGH': ['Strict dietary restrictions', 'Regular monitoring', 'Avoid hepatotoxic drugs', 'Treatment planning'],
        'CRITICAL': ['Immediate hepatology care', 'Hospitalization may be needed', 'Transplant evaluation', 'Intensive care']
      },
      'Alzheimer': {
        'LOW': ['Mental exercises', 'Social engagement', 'Regular checkups'],
        'MODERATE': ['Cognitive therapy', 'Neurology consultation', 'Caregiver support', 'Safety planning'],
        'HIGH': ['Specialist care', 'Medication management', '24/7 supervision planning', 'Support group'],
        'CRITICAL': ['Immediate neurology referral', 'Full-time care planning', 'Advanced directives', 'Palliative support']
      },
      'Pneumonia': {
        'LOW': ['Rest', 'Hydration', 'Monitor symptoms'],
        'MODERATE': ['Antibiotics as prescribed', 'Rest and fluids', 'Follow-up chest X-ray', 'Monitor breathing'],
        'HIGH': ['Hospitalization may be needed', 'Oxygen therapy', 'IV antibiotics', 'Respiratory support'],
        'CRITICAL': ['Emergency care', 'Intensive treatment', 'Respiratory monitoring', 'Critical care unit']
      },
      'Malaria': {
        'LOW': ['Rest', 'Hydration', 'Antimalarial medication'],
        'MODERATE': ['Complete antimalarial course', 'Regular blood tests', 'Monitor fever', 'Stay hydrated'],
        'HIGH': ['Hospitalization', 'IV antimalarials', 'Blood transfusion if needed', 'Intensive monitoring'],
        'CRITICAL': ['Emergency treatment', 'ICU admission', 'Blood exchange transfusion', 'Critical care']
      }
    }
    
    return measures[disease]?.[riskLevel] || ['Consult healthcare provider', 'Follow medical advice', 'Regular monitoring']
  }

  const generatePDFContent = () => {
    const reportDate = new Date().toLocaleDateString()
    const reportTime = new Date().toLocaleTimeString()
    
    // Generate predictions HTML with precautionary measures
    const predictionsHTML = predictions.map((pred, index) => {
      const confidenceColor = pred.confidence >= 80 ? '#22c55e' : pred.confidence >= 60 ? '#3b82f6' : pred.confidence >= 40 ? '#f59e0b' : '#ef4444'
      const precautions = getPrecautionaryMeasures(pred.disease, pred.riskLevel)
      
      let detailsHTML = ''
      if (pred.details) {
        detailsHTML = Object.entries(pred.details)
          .map(([key, value]) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            const formattedValue = typeof value === 'number' ? `${value.toFixed(1)}%` : value
            return `
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">${formattedKey}:</span>
                <span style="font-weight: 500;">${formattedValue}</span>
              </div>
            `
          })
          .join('')
      }

      const precautionsHTML = precautions.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('')
      
      // AI Explanation from the prediction
      const explanationHTML = pred.explanation ? `
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 6px 6px 0; padding: 12px; margin-top: 12px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af; font-size: 13px;">🤖 AI Consulting Message:</p>
          <p style="margin: 0; color: #1e40af; font-size: 12px; line-height: 1.5;">${pred.explanation}</p>
        </div>
      ` : ''

      return `
        <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; color: #111827; font-size: 16px;">${index + 1}. ${pred.disease}</h3>
            <span style="background: ${confidenceColor}20; color: ${confidenceColor}; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">
              ${pred.confidence.toFixed(1)}%
            </span>
          </div>
          <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">
            <strong>Prediction:</strong> ${pred.prediction}
          </p>
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 12px;">
            Risk Level: ${pred.riskLevel} | ${pred.timestamp}
          </p>
          ${detailsHTML ? `<div style="background: #f9fafb; border-radius: 6px; padding: 12px; margin-top: 12px;">${detailsHTML}</div>` : ''}
          ${explanationHTML}
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 12px; margin-top: 12px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 13px;">⚠️ Precautionary Measures:</p>
            <ul style="margin: 0; padding-left: 16px; color: #92400e; font-size: 12px;">
              ${precautionsHTML}
            </ul>
          </div>
        </div>
      `
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>MedAI Diagnostics Report</title>
        <style>
          @page { margin: 40px; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #1f2937;
            background: #f3f4f6;
          }
          .header { 
            background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
          }
          .header h1 { margin: 0 0 8px 0; font-size: 28px; }
          .header p { margin: 0; opacity: 0.9; }
          .patient-info {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .section-title {
            color: #0d9488;
            font-size: 18px;
            font-weight: 600;
            margin: 24px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #0d9488;
          }
          .disclaimer {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin-top: 30px;
            border-radius: 0 8px 8px 0;
            font-size: 12px;
            color: #92400e;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏥 MedAI Diagnostics</h1>
          <p>Comprehensive AI-Powered Health Report</p>
        </div>
        
        <div class="patient-info">
          <h2 style="margin: 0 0 12px 0; color: #111827;">Patient Information</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Patient Name</p>
              <p style="margin: 4px 0 0 0; font-weight: 500;">${patientName}</p>
            </div>
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Patient ID</p>
              <p style="margin: 4px 0 0 0; font-weight: 500;">${patientId}</p>
            </div>
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Report Date</p>
              <p style="margin: 4px 0 0 0; font-weight: 500;">${reportDate}</p>
            </div>
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Report Time</p>
              <p style="margin: 4px 0 0 0; font-weight: 500;">${reportTime}</p>
            </div>
          </div>
        </div>

        <h2 class="section-title">📊 Real-Time Prediction Results (${predictions.length})</h2>
        ${predictionsHTML}
        
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 20px;">
          Report generated in real-time based on your diagnostic inputs.
        </p>

        <div class="disclaimer">
          <strong>⚠️ Important Disclaimer</strong><br>
          This report is generated by AI/ML models and is for educational and informational purposes only. 
          It does not constitute medical advice, diagnosis, or treatment. Always consult with qualified 
          healthcare professionals for proper medical evaluation and treatment decisions.
        </div>

        <div class="footer">
          <p>Generated by MedAI Diagnostics Platform v1.0</p>
          <p style="margin-top: 4px;">© 2026 MedAI Diagnostics. All rights reserved.</p>
        </div>
      </body>
      </html>
    `
  }

  // Quick compact PDF export
  const handleExportQuickPDF = async () => {
    if (predictions.length === 0) {
      addToast('Please complete at least one disease prediction before exporting', 'warning')
      return
    }

    setIsGenerating(true)
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      let yPos = margin

      // Compact Header
      doc.setFillColor(13, 148, 136)
      doc.rect(0, 0, pageWidth, 25, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('MedAI Summary Report', margin, 15)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${new Date().toLocaleDateString()} | ${patientId}`, margin, 22)

      yPos = 35

      // Quick Summary Table Header
      doc.setFillColor(243, 244, 246)
      doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F')
      doc.setTextColor(31, 41, 55)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Disease', margin + 5, yPos + 7)
      doc.text('Result', margin + 70, yPos + 7)
      doc.text('Confidence', margin + 120, yPos + 7)
      doc.text('Risk', margin + 155, yPos + 7)
      yPos += 12

      // Table Rows
      predictions.forEach((pred, i) => {
        const bgColor = i % 2 === 0 ? 255 : 250
        doc.setFillColor(bgColor, bgColor, bgColor)
        doc.rect(margin, yPos - 2, pageWidth - 2 * margin, 8, 'F')
        
        // Risk color dot
        const riskColors: Record<string, [number, number, number]> = {
          'LOW': [34, 197, 94],
          'MODERATE': [59, 130, 246],
          'HIGH': [245, 158, 11],
          'CRITICAL': [239, 68, 68]
        }
        const [r, g, b] = riskColors[pred.riskLevel] || [128, 128, 128]
        doc.setFillColor(r, g, b)
        doc.circle(margin + 2, yPos + 2, 2, 'F')

        doc.setTextColor(31, 41, 55)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(pred.disease.substring(0, 25), margin + 8, yPos + 4)
        doc.text(pred.prediction.substring(0, 20), margin + 70, yPos + 4)
        doc.text(`${pred.confidence.toFixed(1)}%`, margin + 125, yPos + 4)
        doc.text(pred.riskLevel, margin + 155, yPos + 4)
        yPos += 10
      })

      yPos += 8

      // Quick Summary Text
      doc.setTextColor(31, 41, 55)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Quick Summary:', margin, yPos)
      yPos += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const summaryText = `${predictions.length} prediction(s) completed. High-risk conditions require immediate medical attention.`
      const splitText = doc.splitTextToSize(summaryText, pageWidth - 2 * margin)
      doc.text(splitText, margin, yPos)

      // Compact Disclaimer
      doc.setFillColor(254, 243, 199)
      doc.rect(margin, 270, pageWidth - 2 * margin, 15, 'F')
      doc.setTextColor(146, 64, 14)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('For informational purposes only. Consult healthcare professionals for medical advice.', margin + 3, 278)

      // Save
      doc.save(`medai-summary-${patientId}-${new Date().toISOString().split('T')[0]}.pdf`)
      
      addToast('Summary PDF downloaded!', 'success')
      setShowModal(false)
    } catch (error) {
      console.error('PDF generation error:', error)
      addToast('Failed to generate PDF', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Detailed comprehensive PDF export
  const handleExportDetailedPDF = async () => {
    if (predictions.length === 0) {
      addToast('Please complete at least one disease prediction before exporting', 'warning')
      return
    }

    setIsGenerating(true)
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let yPos = margin

      // Header
      doc.setFillColor(13, 148, 136) // Teal color
      doc.rect(0, 0, pageWidth, 35, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('MedAI Diagnostics Report', margin, 20)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 28)

      yPos = 45

      // Patient Info Section
      doc.setTextColor(31, 41, 55)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Patient Information', margin, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Patient ID: ${patientId}`, margin, yPos)
      yPos += 6
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPos)
      yPos += 12

      // Summary Section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Executive Summary', margin, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const summaryText = `This report contains ${predictions.length} disease prediction(s) generated by AI/ML models based on the diagnostic inputs provided during this session. All predictions are real-time assessments and should be reviewed by qualified healthcare professionals.`
      const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 2 * margin)
      doc.text(splitSummary, margin, yPos)
      yPos += splitSummary.length * 5 + 8

      // Predictions Section
      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i]
        const analysis = getDiseaseAnalysis(pred.disease, pred.riskLevel, pred.confidence, pred.inputs)

        // Check if we need a new page
        if (yPos > pageHeight - 80) {
          doc.addPage()
          yPos = margin
        }

        // Disease Header Box
        doc.setFillColor(240, 253, 250) // Light teal
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 20, 'F')
        
        // Risk color indicator
        const riskColors: Record<string, [number, number, number]> = {
          'LOW': [34, 197, 94],
          'MODERATE': [59, 130, 246],
          'HIGH': [245, 158, 11],
          'CRITICAL': [239, 68, 68]
        }
        const [r, g, b] = riskColors[pred.riskLevel] || [128, 128, 128]
        doc.setFillColor(r, g, b)
        doc.rect(margin, yPos - 5, 4, 20, 'F')

        doc.setTextColor(17, 24, 39)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(`${i + 1}. ${pred.disease}`, margin + 8, yPos + 5)
        
        doc.setTextColor(r, g, b)
        doc.setFontSize(11)
        doc.text(`${pred.confidence.toFixed(1)}% Confidence | ${pred.riskLevel} Risk`, margin + 8, yPos + 12)
        yPos += 22

        // Analysis Summary
        doc.setTextColor(31, 41, 55)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Analysis Summary', margin, yPos)
        yPos += 6

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const summaryLines = doc.splitTextToSize(analysis.summary, pageWidth - 2 * margin)
        doc.text(summaryLines, margin, yPos)
        yPos += summaryLines.length * 4 + 6

        // Key Risk Factors
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Key Risk Factors', margin, yPos)
        yPos += 6

        doc.setFontSize(9)
        analysis.riskFactors.forEach(factor => {
          doc.text(`• ${factor}`, margin + 3, yPos)
          yPos += 4
        })
        yPos += 4

        // Recommendations
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Recommendations', margin, yPos)
        yPos += 6

        doc.setFontSize(9)
        analysis.recommendations.forEach(rec => {
          doc.text(`• ${rec}`, margin + 3, yPos)
          yPos += 4
        })
        yPos += 8

        // AI Explanation if available
        if (pred.explanation) {
          doc.setFillColor(239, 246, 255)
          doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 12, 'F')
          doc.setTextColor(30, 58, 138)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'italic')
          const expLines = doc.splitTextToSize(`AI Note: ${pred.explanation}`, pageWidth - 2 * margin - 4)
          doc.text(expLines, margin + 2, yPos + 3)
          yPos += 16
        }

        yPos += 6
      }

      // Disclaimer
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = margin
      }

      doc.setFillColor(254, 243, 199)
      doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F')
      doc.setTextColor(146, 64, 14)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('IMPORTANT DISCLAIMER', margin + 3, yPos + 6)
      doc.setFont('helvetica', 'normal')
      const disclaimer = doc.splitTextToSize(
        'This report is generated by AI/ML models for educational and informational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for proper medical evaluation and treatment decisions.',
        pageWidth - 2 * margin - 6
      )
      doc.text(disclaimer, margin + 3, yPos + 12)

      // Footer
      doc.setTextColor(156, 163, 175)
      doc.setFontSize(8)
      doc.text('© 2026 MedAI Diagnostics. All rights reserved.', margin, pageHeight - 10)
      doc.text(`Report ID: ${patientId}`, pageWidth - margin - 40, pageHeight - 10)

      // Save PDF
      doc.save(`medai-detailed-report-${patientId}-${new Date().toISOString().split('T')[0]}.pdf`)
      
      addToast('Detailed PDF report downloaded!', 'success')
      setShowModal(false)
    } catch (error) {
      console.error('PDF generation error:', error)
      addToast('Failed to generate PDF report', 'error')
    } finally {
      setIsGenerating(false)
    }
  }



  // Render button based on predictions
  const hasPredictions = predictions.length > 0

  if (!hasPredictions) {
    return (
      <button
        key="disabled-export"
        disabled
        className="glassmorphism text-white/50 p-2 rounded-lg flex items-center gap-2 cursor-not-allowed opacity-50"
        title="Complete at least one disease prediction to export report"
      >
        <FileText className="w-5 h-5" />
        <span>Export Report</span>
      </button>
    )
  }

  return (
    <>
      <button
        key="enabled-export"
        onClick={() => setShowModal(true)}
        className="glassmorphism text-white p-2 rounded-lg transition-all flex items-center gap-2 hover:bg-white/10"
      >
        <FileText className="w-5 h-5" />
        <span>Export Report ({predictions.length})</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9998] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Export Report
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExportQuickPDF}
                disabled={isGenerating}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-all transform hover:scale-[1.02] disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold">Export Quick PDF</p>
                  <p className="text-sm opacity-90">Compact summary table</p>
                </div>
              </button>

              <button
                onClick={handleExportDetailedPDF}
                disabled={isGenerating}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all transform hover:scale-[1.02] disabled:opacity-50"
              >
                <FileText className="w-5 h-5" />
                <div className="text-left flex-1">
                  <p className="font-semibold">Export Detailed PDF</p>
                  <p className="text-sm opacity-90">Comprehensive medical report</p>
                </div>
                <div className="text-xs bg-white/20 px-2 py-1 rounded">
                  {predictions.length} predictions
                </div>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
