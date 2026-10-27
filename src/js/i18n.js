(() => {
  'use strict';
  const pairs = {
    'Entry Recorder':['ಬಸ್ ಪ್ರವೇಶ ಸಿಬ್ಬಂದಿ','बस प्रवेश कर्मचारी'],'Cleaner Hub':['ಸ್ವಚ್ಛತೆ','सफाई'],'Charging Incharge':['ಚಾರ್ಜಿಂಗ್ ಸಿಬ್ಬಂದಿ','चार्जिंग कर्मचारी'],'Depot Manager':['ಡಿಪೋ ವ್ಯವಸ್ಥಾಪಕ','डिपो प्रबंधक'],
    'Smart Fleet':['ಸ್ಮಾರ್ಟ್ ಫ್ಲೀಟ್','स्मार्ट फ्लीट'], 'Welcome to Smart Fleet':['ಸ್ಮಾರ್ಟ್ ಫ್ಲೀಟ್‌ಗೆ ಸ್ವಾಗತ','स्मार्ट फ्लीट में आपका स्वागत है'],
    'Sign in to open your work screen.':['ನಿಮ್ಮ ಕೆಲಸದ ಪರದೆ ತೆರೆಯಲು ಪ್ರವೇಶಿಸಿ.','अपना काम खोलने के लिए साइन इन करें।'],
    'User ID':['ಬಳಕೆದಾರರ ಹೆಸರು','यूज़र आईडी'],'Password':['ಗುಪ್ತಪದ','पासवर्ड'],'Show':['ತೋರಿಸಿ','दिखाएँ'],'Hide':['ಮರೆಮಾಡಿ','छिपाएँ'],'Sign in':['ಪ್ರವೇಶಿಸಿ','साइन इन करें'],
    'Sign out':['ಹೊರಬನ್ನಿ','साइन आउट'],'Logout':['ಹೊರಬನ್ನಿ','साइन आउट'],'Bus entry':['ಬಸ್ ಪ್ರವೇಶ','बस प्रवेश'],'Cleaning':['ಸ್ವಚ್ಛತೆ','सफाई'],'Charging':['ಚಾರ್ಜಿಂಗ್','चार्जिंग'],'Depot manager':['ಡಿಪೋ ವ್ಯವಸ್ಥಾಪಕ','डिपो प्रबंधक'],
    'Tap the bus that has arrived.':['ಬಂದಿರುವ ಬಸ್ ಮೇಲೆ ಒತ್ತಿ.','जो बस आई है उसे चुनें।'],
    'Tap the bus you have finished cleaning.':['ಸ್ವಚ್ಛಗೊಳಿಸಿದ ಬಸ್ ಮೇಲೆ ಒತ್ತಿ.','जिस बस की सफाई पूरी हुई है उसे चुनें।'],
    'Tap the bus you have finished charging.':['ಚಾರ್ಜಿಂಗ್ ಮುಗಿದ ಬಸ್ ಮೇಲೆ ಒತ್ತಿ.','जिस बस की चार्जिंग पूरी हुई है उसे चुनें।'],
    'Review your depot and resolve reported problems.':['ನಿಮ್ಮ ಡಿಪೋ ಮತ್ತು ವರದಿಯಾದ ಸಮಸ್ಯೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.','अपने डिपो और बताई गई समस्याओं की जाँच करें।'],
    'Bus entered':['ಬಸ್ ಪ್ರವೇಶಿಸಿದೆ','बस आ गई'],'Cleaning done':['ಸ್ವಚ್ಛತೆ ಮುಗಿದಿದೆ','सफाई पूरी'],'Charging done':['ಚಾರ್ಜಿಂಗ್ ಮುಗಿದಿದೆ','चार्जिंग पूरी'],
    'Choose a bus':['ಬಸ್ ಆಯ್ಕೆ ಮಾಡಿ','बस चुनें'],'Bus number or registration':['ಬಸ್ ಸಂಖ್ಯೆ ಅಥವಾ ನೋಂದಣಿ ಸಂಖ್ಯೆ','बस नंबर या पंजीकरण नंबर'],
    'Example: 304 or KA51AJ0137':['ಉದಾ: 304 ಅಥವಾ KA51AJ0137','उदाहरण: 304 या KA51AJ0137'],
    '▣ Scan plate':['▣ ನಂಬರ್ ಪ್ಲೇಟ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ','▣ नंबर प्लेट स्कैन करें'],'↻ Refresh':['↻ ಮತ್ತೆ ನೋಡಿ','↻ फिर देखें'],
    '▶ Listen':['▶ ಕೇಳಿ','▶ सुनें'],'Recently completed':['ಇತ್ತೀಚೆಗೆ ಮುಗಿದ ಕೆಲಸ','हाल में पूरा काम'],
    'For a correction, contact your depot manager. Approvals are not reversed automatically.':['ತಿದ್ದುಪಡಿಗಾಗಿ ಡಿಪೋ ವ್ಯವಸ್ಥಾಪಕರನ್ನು ಸಂಪರ್ಕಿಸಿ.','सुधार के लिए डिपो प्रबंधक से संपर्क करें।'],
    'No completed buses yet.':['ಇನ್ನೂ ಯಾವುದೇ ಬಸ್ ಕೆಲಸ ಮುಗಿದಿಲ್ಲ.','अभी कोई बस पूरी नहीं हुई है।'],
    'No matching bus. Check the number or clear your search.':['ಬಸ್ ಸಿಗಲಿಲ್ಲ. ಸಂಖ್ಯೆ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಹುಡುಕಾಟ ಅಳಿಸಿ.','बस नहीं मिली। नंबर जाँचें या खोज हटाएँ।'],
    '✓ No buses waiting. Refresh when the next bus arrives.':['✓ ಕಾಯುತ್ತಿರುವ ಬಸ್‌ಗಳಿಲ್ಲ. ಮುಂದಿನ ಬಸ್ ಬಂದಾಗ ಮತ್ತೆ ನೋಡಿ.','✓ कोई बस बाकी नहीं है। अगली बस आने पर फिर देखें।'],
    'Check that this is the correct bus.':['ಇದೇ ಸರಿಯಾದ ಬಸ್ ಎಂದು ಪರಿಶೀಲಿಸಿ.','जाँचें कि यही सही बस है।'],
    'Yes, save':['ಹೌದು, ಉಳಿಸಿ','हाँ, सेव करें'],'Go back':['ಹಿಂದೆ ಹೋಗಿ','वापस जाएँ'],
    '⚠ Report problem':['⚠ ಸಮಸ್ಯೆ ತಿಳಿಸಿ','⚠ समस्या बताएँ'],'What is wrong?':['ಏನು ಸಮಸ್ಯೆ?','क्या समस्या है?'],
    'The bus will be held for manager review.':['ವ್ಯವಸ್ಥಾಪಕರ ಪರಿಶೀಲನೆವರೆಗೆ ಬಸ್ ತಡೆಹಿಡಿಯಲಾಗುತ್ತದೆ.','प्रबंधक की जाँच तक बस रोकी जाएगी।'],
    'Bus needs repair':['ಬಸ್ ದುರಸ್ತಿ ಬೇಕು','बस की मरम्मत चाहिए'],'Cleaning incomplete':['ಸ್ವಚ್ಛತೆ ಮುಗಿದಿಲ್ಲ','सफाई अधूरी है'],'Charger not working':['ಚಾರ್ಜರ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ','चार्जर काम नहीं कर रहा'],'Battery not ready':['ಬ್ಯಾಟರಿ ಸಿದ್ಧವಿಲ್ಲ','बैटरी तैयार नहीं'],'Wrong bus details':['ಬಸ್ ವಿವರಗಳು ತಪ್ಪಾಗಿವೆ','बस की जानकारी गलत है'],'Other problem':['ಇತರ ಸಮಸ್ಯೆ','दूसरी समस्या'],
    'More details (optional)':['ಹೆಚ್ಚಿನ ವಿವರಗಳು (ಐಚ್ಛಿಕ)','और जानकारी (वैकल्पिक)'],'Save problem':['ಸಮಸ್ಯೆ ಉಳಿಸಿ','समस्या सेव करें'],
    '⚠ Problem reported · On hold':['⚠ ಸಮಸ್ಯೆ ವರದಿಯಾಗಿದೆ · ತಡೆಹಿಡಿದಿದೆ','⚠ समस्या बताई गई · रोक लगी है'],
    '⚠ This bus is on hold. Ask the depot manager to review the problem.':['⚠ ಈ ಬಸ್ ತಡೆಹಿಡಿದಿದೆ. ಡಿಪೋ ವ್ಯವಸ್ಥಾಪಕರನ್ನು ಸಂಪರ್ಕಿಸಿ.','⚠ इस बस पर रोक है। डिपो प्रबंधक से जाँच कराएँ।'],
    'Reported problems':['ವರದಿಯಾದ ಸಮಸ್ಯೆಗಳು','बताई गई समस्याएँ'],'Review and resolve':['ಪರಿಶೀಲಿಸಿ ಪರಿಹರಿಸಿ','जाँचें और हल करें'],
    'Resolve reported problem':['ವರದಿಯಾದ ಸಮಸ್ಯೆ ಪರಿಹರಿಸಿ','बताई गई समस्या हल करें'],'What was checked or corrected?':['ಏನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ ಅಥವಾ ಸರಿಪಡಿಸಲಾಗಿದೆ?','क्या जाँचा या सुधारा गया?'],'Resolve problem':['ಸಮಸ್ಯೆ ಪರಿಹರಿಸಿ','समस्या हल करें'],
    'Resolve only after checking the bus. Resolving a problem removes its hold; it does not approve any work.':['ಬಸ್ ಪರಿಶೀಲಿಸಿದ ನಂತರವೇ ಸಮಸ್ಯೆ ಪರಿಹರಿಸಿ. ಇದು ಕೆಲಸಕ್ಕೆ ಅನುಮೋದನೆ ನೀಡುವುದಿಲ್ಲ.','बस की जाँच के बाद ही समस्या हल करें। इससे काम की मंज़ूरी नहीं होती।'],
    '✓ No open problems.':['✓ ಬಾಕಿ ಸಮಸ್ಯೆಗಳಿಲ್ಲ.','✓ कोई समस्या बाकी नहीं।'],'Entry':['ಪ್ರವೇಶ','प्रवेश'],'Ready':['ಸಿದ್ಧ','तैयार'],'Assigned':['ನಿಯೋಜಿಸಲಾಗಿದೆ','नियुक्त'],'Problems':['ಸಮಸ್ಯೆಗಳು','समस्याएँ'],
    '← Previous':['← ಹಿಂದಿನವು','← पिछली'],'Next →':['ಮುಂದಿನವು →','अगली →'],'Not recorded':['ದಾಖಲಾಗಿಲ್ಲ','दर्ज नहीं'],
    'No live charger connection. Check the charger display before confirming.':['ಚಾರ್ಜರ್‌ಗೆ ನೇರ ಸಂಪರ್ಕವಿಲ್ಲ. ದೃಢಪಡಿಸುವ ಮೊದಲು ಚಾರ್ಜರ್ ಪರದೆ ಪರಿಶೀಲಿಸಿ.','चार्जर से सीधा संपर्क नहीं है। पुष्टि से पहले चार्जर की स्क्रीन जाँचें।'],
    'Battery information is from the bundled sample data.':['ಬ್ಯಾಟರಿ ಮಾಹಿತಿ ಮಾದರಿ ದತ್ತಾಂಶದಿಂದ ಬಂದಿದೆ.','बैटरी की जानकारी नमूना डेटा से है।'],
    'Could not load buses. Use Refresh to try again.':['ಬಸ್ ಮಾಹಿತಿ ಸಿಗಲಿಲ್ಲ. ಮತ್ತೆ ನೋಡಿ ಬಟನ್ ಒತ್ತಿ.','बसों की जानकारी नहीं मिली। फिर देखें बटन दबाएँ।'],
    'Problem not saved. Please try again.':['ಸಮಸ್ಯೆ ಉಳಿಸಲಾಗಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.','समस्या सेव नहीं हुई। फिर प्रयास करें।'],
    '✓ Problem resolved. The worker can review the bus again.':['✓ ಸಮಸ್ಯೆ ಪರಿಹರಿಸಲಾಗಿದೆ. ಸಿಬ್ಬಂದಿ ಬಸ್ ಮತ್ತೆ ಪರಿಶೀಲಿಸಬಹುದು.','✓ समस्या हल हो गई। कर्मचारी बस फिर जाँच सकता है।'],
    'Depot server':['ಡಿಪೋ ಸರ್ವರ್','डिपो सर्वर'],'Server settings':['ಸರ್ವರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು','सर्वर सेटिंग'],'Connect':['ಸಂಪರ್ಕಿಸಿ','जोड़ें'],'Connected':['ಸಂಪರ್ಕಗೊಂಡಿದೆ','जुड़ा हुआ'],'Connecting…':['ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…','जोड़ रहे हैं…'],'Offline — reconnect before saving':['ಆಫ್‌ಲೈನ್ — ಉಳಿಸುವ ಮೊದಲು ಸಂಪರ್ಕಿಸಿ','ऑफ़लाइन — सेव करने से पहले जोड़ें'],
    'Configure the depot server to sign in.':['ಪ್ರವೇಶಿಸಲು ಡಿಪೋ ಸರ್ವರ್ ಹೊಂದಿಸಿ.','साइन इन करने के लिए डिपो सर्वर जोड़ें।'],
    'Demo — data stays on this device':['ಮಾದರಿ — ದತ್ತಾಂಶ ಈ ಸಾಧನದಲ್ಲೇ ಉಳಿಯುತ್ತದೆ','डेमो — डेटा इसी डिवाइस पर रहता है'],
    'Saved on this browser only. Other phones do not receive these updates.':['ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ ಉಳಿಸಲಾಗಿದೆ. ಇತರ ಫೋನ್‌ಗಳಿಗೆ ಮಾಹಿತಿ ಹೋಗುವುದಿಲ್ಲ.','केवल इस डिवाइस पर सेव है। दूसरे फोन को जानकारी नहीं मिलेगी।'],
    'Connected to the depot server.':['ಡಿಪೋ ಸರ್ವರ್‌ಗೆ ಸಂಪರ್ಕಗೊಂಡಿದೆ.','डिपो सर्वर से जुड़ा हुआ।'],
    'Scheduler':['ವೇಳಾಪಟ್ಟಿ ನಿರ್ವಾಹಕ','शेड्यूलर'],'Scheduler Console':['ವೇಳಾಪಟ್ಟಿ ನಿರ್ವಹಣೆ','शेड्यूल प्रबंधन'],'Route & Driver Assignment.':['ಮಾರ್ಗ ಮತ್ತು ಚಾಲಕ ನಿಯೋಜನೆ.','मार्ग और चालक नियुक्ति।'],
    '1. Choose trip':['1. ಟ್ರಿಪ್ ಆಯ್ಕೆ ಮಾಡಿ','1. ट्रिप चुनें'],'2. Choose bus':['2. ಬಸ್ ಆಯ್ಕೆ ಮಾಡಿ','2. बस चुनें'],'3. Choose driver':['3. ಚಾಲಕ ಆಯ್ಕೆ ಮಾಡಿ','3. चालक चुनें'],'Assign bus and driver':['ಬಸ್ ಮತ್ತು ಚಾಲಕ ನಿಯೋಜಿಸಿ','बस और चालक नियुक्त करें'],
    'Available Buses in Ready Pool:':['ಸಿದ್ಧವಾಗಿರುವ ಬಸ್‌ಗಳು:','तैयार बसें:'],'-- Choose Schedule (Route) --':['-- ಟ್ರಿಪ್ (ಮಾರ್ಗ) ಆಯ್ಕೆ ಮಾಡಿ --','-- ट्रिप (मार्ग) चुनें --'],'-- Select a route first --':['-- ಮೊದಲು ಮಾರ್ಗ ಆಯ್ಕೆ ಮಾಡಿ --','-- पहले मार्ग चुनें --'],
    'Bus availability changed. Choose the trip and bus again.':['ಬಸ್ ಲಭ್ಯತೆ ಬದಲಾಗಿದೆ. ಟ್ರಿಪ್ ಮತ್ತು ಬಸ್ ಮತ್ತೆ ಆಯ್ಕೆ ಮಾಡಿ.','बस की उपलब्धता बदली है। ट्रिप और बस फिर चुनें।'],
    'Invalid user ID or password.':['ಬಳಕೆದಾರರ ಹೆಸರು ಅಥವಾ ಗುಪ್ತಪದ ತಪ್ಪಾಗಿದೆ.','यूज़र आईडी या पासवर्ड गलत है।'],
    'Bus returned':['ಬಸ್ ಹಿಂದಿರುಗಿದೆ','बस वापस आई'],'Confirm bus return':['ಬಸ್ ಹಿಂದಿರುಗಿರುವುದನ್ನು ದೃಢಪಡಿಸಿ','बस की वापसी की पुष्टि करें'],
    'Return this bus only after it has physically arrived at the depot.':['ಬಸ್ ಡಿಪೋಗೆ ಬಂದ ನಂತರವೇ ದೃಢಪಡಿಸಿ.','बस के डिपो पहुँचने के बाद ही पुष्टि करें।'],
    'Assigned buses':['ನಿಯೋಜಿಸಿದ ಬಸ್‌ಗಳು','नियुक्त बसें'],'Fleet Admin':['ಫ್ಲೀಟ್ ಆಡ್ಮಿನ್','फ्लीट एडमिन'],'Staff accounts':['ಸಿಬ್ಬಂದಿ ಖಾತೆಗಳು','कर्मचारी खाते'],'Create or update staff account':['ಸಿಬ್ಬಂದಿ ಖಾತೆ ರಚಿಸಿ ಅಥವಾ ಬದಲಿಸಿ','कर्मचारी खाता बनाएँ या बदलें'],'Work role':['ಕೆಲಸದ ಪಾತ್ರ','काम की भूमिका'],'Depot':['ಡಿಪೋ','डिपो'],
    'Audio is not available in this language on this phone.':['ಈ ಫೋನ್‌ನಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ.','इस फोन पर इस भाषा की आवाज़ उपलब्ध नहीं है।'],
    'Sign in again to continue':['ಮುಂದುವರಿಸಲು ಮತ್ತೆ ಪ್ರವೇಶಿಸಿ','जारी रखने के लिए फिर साइन इन करें'],'Failed to fetch':['ಸರ್ವರ್ ಸಂಪರ್ಕ ಸಿಗಲಿಲ್ಲ','सर्वर से संपर्क नहीं हुआ'],'This bus has already changed. Refresh and choose again.':['ಬಸ್ ಮಾಹಿತಿ ಬದಲಾಗಿದೆ. ಮತ್ತೆ ನೋಡಿ ಆಯ್ಕೆ ಮಾಡಿ.','बस की जानकारी बदली है। फिर देखकर चुनें।'],'Account saved. Previous sessions for this account have ended.':['ಖಾತೆ ಉಳಿಸಲಾಗಿದೆ. ಈ ಖಾತೆಯ ಹಿಂದಿನ ಪ್ರವೇಶಗಳು ಮುಗಿದಿವೆ.','खाता सेव हुआ। इस खाते के पुराने सत्र समाप्त हुए।'],
    'Save could not be confirmed. Refresh to check recent work.':['ಉಳಿಸಲಾಗಿದೆಯೇ ಎಂದು ದೃಢಪಡಿಸಲಾಗಲಿಲ್ಲ. ಇತ್ತೀಚಿನ ಕೆಲಸವನ್ನು ಮತ್ತೆ ನೋಡಿ.','सेव की पुष्टि नहीं हो सकी। हाल का काम फिर देखें।'],
    'Starting server…':['ಸರ್ವರ್ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ…','सर्वर शुरू हो रहा है…'],'Server is not ready yet. Please try again.':['ಸರ್ವರ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.','सर्वर अभी तैयार नहीं है। फिर प्रयास करें।'],
    'Submit':['ಸಲ್ಲಿಸಿ','जमा करें'],'Search Bus':['ಬಸ್ ಹುಡುಕಿ','बस खोजें'],'Depot Intake & Entry Recorder':['ಡಿಪೋ ಬಸ್ ಪ್ರವೇಶ','डिपो बस प्रवेश'],'Cleaning Bay Operations':['ಬಸ್ ಸ್ವಚ್ಛತೆ','बस सफाई'],'Charging Infrastructure Operations':['ಬಸ್ ಚಾರ್ಜಿಂಗ್','बस चार्जिंग'],
    'Close':['ಮುಚ್ಚಿ','बंद करें'],'Cancel':['ರದ್ದುಮಾಡಿ','रद्द करें'],'Save':['ಉಳಿಸಿ','सेव करें'],
    'Scan bus number plate':['ಬಸ್ ನಂಬರ್ ಪ್ಲೇಟ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ','बस की नंबर प्लेट स्कैन करें'],'Capture & scan':['ಚಿತ್ರ ತೆಗೆದು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ','फोटो लेकर स्कैन करें'],'Retry camera':['ಕ್ಯಾಮೆರಾ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ','कैमरा फिर खोलें'],'Use phone camera or choose photo':['ಫೋನ್ ಕ್ಯಾಮೆರಾ ಅಥವಾ ಫೋಟೋ ಬಳಸಿ','फोन कैमरा या फोटो चुनें'],'Detected text (edit if needed)':['ಪತ್ತೆಯಾದ ಪಠ್ಯ (ಬೇಕಾದರೆ ತಿದ್ದಿ)','पहचाना गया पाठ (ज़रूरत हो तो सुधारें)'],'Match plate to bus':['ಪ್ಲೇಟ್‌ನಿಂದ ಬಸ್ ಹುಡುಕಿ','प्लेट से बस खोजें']
  };
  const patterns = [
    [/^✓ Bus (.+) approved and saved\.$/, ['✓ ಬಸ್ $1 ಅನುಮೋದಿಸಲಾಗಿದೆ ಮತ್ತು ಉಳಿಸಲಾಗಿದೆ.','✓ बस $1 की मंज़ूरी सेव हुई।']],
    [/^Not saved\. (.*)$/, ['ಉಳಿಸಲಾಗಿಲ್ಲ. $1','सेव नहीं हुआ। $1']],
    [/^✓ (Bus entered|Cleaning done|Charging done)$/, ['✓ $1','✓ $1']],
    [/^(\d+) waiting$/, ['$1 ಕಾಯುತ್ತಿವೆ','$1 बाकी']],
    [/^Selected bus: (.+)$/, ['ಆಯ್ಕೆಯಾದ ಬಸ್: $1','चुनी गई बस: $1']],
    [/^Report problem · (.+)$/, ['ಸಮಸ್ಯೆ ತಿಳಿಸಿ · $1','समस्या बताएँ · $1']],
    [/^(Bus entered|Cleaning done|Charging done)\?$/, ['$1?','$1?']],
    [/^✓ (.+) · (Bus entered|Cleaning done|Charging done) saved\.$/, ['✓ $1 · $2 ಉಳಿಸಲಾಗಿದೆ.','✓ $1 · $2 सेव हुआ।']],
    [/^⚠ (.+) · Problem saved\. Ask your depot manager to review it\.$/, ['⚠ $1 · ಸಮಸ್ಯೆ ಉಳಿಸಲಾಗಿದೆ. ಡಿಪೋ ವ್ಯವಸ್ಥಾಪಕರನ್ನು ಸಂಪರ್ಕಿಸಿ.','⚠ $1 · समस्या सेव हुई। डिपो प्रबंधक से जाँच कराएँ।']],
    [/^Battery:$/, ['ಬ್ಯಾಟರಿ:','बैटरी:']],[/^· Charger:$/, ['· ಚಾರ್ಜರ್:','· चार्जर:']],
    [/^(\d+)–(\d+) of (\d+)$/, ['$3ರಲ್ಲಿ $1–$2','$3 में से $1–$2']]
  ];
  let language = localStorage.getItem('fleet_language') || 'en'; if (!['en','kn','hi'].includes(language)) language='en';
  const originals = new WeakMap(), attrs = new WeakMap();
  function t(source) {
    if(language==='en')return source;
    const index=language==='kn'?0:1;
    if(pairs[source])return pairs[source][index];
    for(const [regex,values] of patterns) if(regex.test(source)) {
      const match=source.match(regex);
      return values[index].replace(/\$(\d+)/g,(_,n)=>t(match[Number(n)]));
    }
    return source;
  }
  let observer;
  function translate() {
    observer?.disconnect();
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest('script,style,[data-no-translate]'))continue;
      const old=originals.get(node); const source=old&&node.nodeValue===old.output?old.source:node.nodeValue;
      const trimmed=source.trim(), output=source.replace(trimmed,t(trimmed));
      if(node.parentElement?.tagName==='OPTION'&&!node.parentElement.hasAttribute('value'))node.parentElement.setAttribute('value',trimmed);
      if(node.nodeValue!==output)node.nodeValue=output;
      originals.set(node,{source,output});
    }
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element=>{
      if(element.closest('[data-no-translate]'))return;
      const saved=attrs.get(element)||{};
      for(const key of ['placeholder','aria-label','title']){
        const current=element.getAttribute(key);if(current===null)continue;
        const source=saved[key]?.output===current?saved[key].source:current;
        const output=t(source);if(output!==current)element.setAttribute(key,output);saved[key]={source,output};
      }attrs.set(element,saved);
    });
    document.documentElement.lang=language;
    observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  }
  window.FleetI18n={t,get language(){return language;},get locale(){return {en:'en-IN',kn:'kn-IN',hi:'hi-IN'}[language];},setLanguage(value){if(!['en','kn','hi'].includes(value))return;language=value;localStorage.setItem('fleet_language',value);const select=document.getElementById('fleet-language');if(select)select.value=value;translate();window.dispatchEvent(new Event('fleet-language'));}};
  window.addEventListener('storage',event=>{if(event.key==='fleet_language'&&['en','kn','hi'].includes(event.newValue)){language=event.newValue;translate();}});
  document.addEventListener('DOMContentLoaded',()=>{
    const legacy=document.body.dataset.ui==='legacy';
    if(!legacy)document.body.classList.add('mobile-app');
    const bar=document.createElement('div');bar.className='language-bar';
    bar.innerHTML='<label for="fleet-language">🌐</label><select id="fleet-language" aria-label="Language / ಭಾಷೆ / भाषा"><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिन्दी</option></select>';
    if(legacy){
      if(self===top){const header=document.querySelector('.right,.header-top,.header-actions');if(header){const select=bar.querySelector('select');select.className=header.matches('.right')?'act':'theme-toggle';header.append(select);select.value=language;select.onchange=e=>FleetI18n.setLanguage(e.target.value);}}
    }else{document.body.prepend(bar);bar.querySelector('select').value=language;bar.querySelector('select').onchange=e=>FleetI18n.setLanguage(e.target.value);}
    observer=new MutationObserver(translate);translate();
  });
})();
