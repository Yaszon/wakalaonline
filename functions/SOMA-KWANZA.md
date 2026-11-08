# WakalaOnline: Oda za kununua Rial kupitia ClickPesa

Code hii inaongeza Firebase Functions 6 kwenye project ya **yaszone**. Oda zote za kununua Rial (TZS → OMR) zinalipwa **kupitia ClickPesa pekee**. Hakuna njia ya pesa taslimu, ya wakala, wala ya kupakia risiti.

**Kila oda ina njia ZOTE MBILI za kulipa kwa wakati mmoja:**
- **Control number** inatengenezwa kila mara. Mteja analipa kutoka mtandao wowote au benki, kwa kiasi kamili.
- **USSD push** inatumwa mara moja kama mteja ameweka namba ya simu. Anaweza kuomba PIN tena mara 3 kwa `sendUssdPush`.

Njia itakayolipwa kwanza ndiyo inayofanya oda kuwa PAID. Ikilipwa kwa USSD, control number inazimwa. Mteja akilipa kwa njia zote mbili, ziada inaingia kwenye **amana** yake (`amana/{uid}`), na wewe unapata taarifa kwenye `ownerTasks`.

## Mtiririko

```
App: mteja anaandika OMR + mpokeaji Oman (+ namba ya simu) → createRialOrder
   → Server inapiga hesabu (rate kutoka settings/rialRate, ada) → oda PENDING_PAYMENT (dakika 15)
   → Control number ya oda (EXACT)  NA  USSD push (PIN kwenye simu)
   → Mteja analipa kwa njia yoyote kati ya hizo
   → ClickPesa webhook → server inauliza ClickPesa API yenyewe → PAID
   → ownerTasks: "PAY_OMR" → wewe unalipa Oman → completeRialOrder → COMPLETED
   → Amelipa mara mbili → ziada → amana + ownerTasks "EXTRA_PAYMENT"
   → Haikulipwa kwa wakati → EXPIRED (control number inazimwa)
```

Oda inahesabiwa kuwa **PAID** pale tu API ya ClickPesa inapothibitisha malipo. Taarifa ya webhook peke yake haitoshi. Kama webhook ikipotea, `pollRialOrders` inaangalia kila baada ya dakika 2.

## Functions

| Function | Aina | Kazi |
|---|---|---|
| `getRialQuote` | callable | Bei tu (rate, ada, jumla TZS), bila kutengeneza oda |
| `createRialOrder` | callable | Inatengeneza oda, control number, na USSD push (kama namba ya simu imewekwa) |
| `sendUssdPush` | callable | Inatuma ombi la PIN tena kwa oda inayosubiri malipo (mara 3 kwa juu) |
| `clickpesaWebhook` | HTTPS | ClickPesa wanaipigia malipo yakibadilika |
| `pollRialOrders` | kila dakika 2 | Inathibitisha malipo yaliyopitwa na webhook, na kufunga oda zilizoisha muda |
| `completeRialOrder` | callable, **wewe tu** | Inathibitisha kwamba OMR imelipwa Oman |

## Kuweka hewani kupitia GitHub (bila kompyuta)

Code hii iko kwenye repo ya **wakalaonline**, folda ya `functions/`. GitHub Action (`.github/workflows/functions.yml`) inaipima na ku-deploy kwenye Firebase project ya **yaszone** kila mabadiliko yanapoingia `main`. Inagusa **codebase ya `rial` tu**, kwa hiyo function ya Whisper na nyingine hazibadilishwi wala kufutwa.

**Mara moja tu, weka GitHub secrets 4** (repo → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Inatoka wapi |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_YASZONE` | Firebase console → ⚙️ Project settings → Service accounts → **Generate new private key**. Bandika JSON yote. |
| `CLICKPESA_CLIENT_ID` | ClickPesa dashboard → application "wakalaonline" |
| `CLICKPESA_API_KEY` | ClickPesa dashboard → application "wakalaonline" |
| `CLICKPESA_CHECKSUM_KEY` | ClickPesa dashboard → application "wakalaonline" |

Service account hiyo inahitaji ruhusa za kudeploy functions na kuweka secrets: **Firebase Admin**, **Cloud Functions Admin**, **Secret Manager Admin**, na **Service Account User**. Ya "firebase-adminsdk" inayotengenezwa na Firebase kwa kawaida inahitaji kuongezewa hizo kwenye Google Cloud → IAM.

**Kisha:**
1. GitHub → **Actions** → "Firebase Functions (oda za Rial – ClickPesa)" → **Run workflow**, na uweke tiki kwenye **update_secrets**. Hii inaweka funguo za ClickPesa kwenye Firebase, kisha inadeploy.
2. Mara zijazo, kila badiliko kwenye `functions/` likiingia `main`, linadeploy lenyewe.
3. Kutoka sandbox kwenda production: badilisha `functions/.env` kuwa `CLICKPESA_ENV=production`, kisha bonyeza **Run workflow** tena, ukiweka tiki kwenye update_secrets kama funguo za production ni tofauti.

Project inahitaji mpango wa **Blaze** (pay-as-you-go) ili kutumia Functions na Secret Manager. Kwa kuwa tayari una function ya Whisper, kuna uwezekano mkubwa uko kwenye Blaze tayari.

## Hatua za kuweka (mara moja)

1. **Nakili folda**: weka `functions/clickpesa/` na `functions/rial/` ndani ya folda yako ya `functions`. Kwenye `functions/index.js` yako iliyopo, ongeza mistari iliyo kwenye `functions/index.js` ya hapa. Usiifute ya Whisper.
2. **Region**: code inatumia `europe-west1`. Kama functions zako nyingine ziko region nyingine, badilisha `REGION` kwenye `functions/rial/index.js`.
3. **Funguo za ClickPesa** (kutoka ClickPesa dashboard, application "wakalaonline"):
   ```
   firebase functions:secrets:set CLICKPESA_CLIENT_ID
   firebase functions:secrets:set CLICKPESA_API_KEY
   firebase functions:secrets:set CLICKPESA_CHECKSUM_KEY
   ```
4. **Sandbox au production**: kwenye `functions/.env` andika `CLICKPESA_ENV=sandbox`. Badilisha kuwa `production` baada ya majaribio.
5. **Weka rate** kwenye Firestore, `settings/rialRate`. Ni wewe tu unayeweza kuibadilisha:
   ```json
   {
     "tzsPerOmr": 6700,
     "minOmr": 5,
     "maxOmr": 2000,
     "feesEnabled": true,
     "feeTiers": [ { "upToTzs": 500000, "fee": 2000 }, { "upToTzs": null, "fee": 4000 } ],
     "feeExemptUids": [],
     "ownerUids": ["UID_YAKO_YA_FIREBASE"]
   }
   ```
   `feeExemptUids` ni wateja wasiolipa ada. `ownerUids` ni wewe tu: ndiye unayeweza kuita `completeRialOrder`.
6. **Deploy**: `firebase deploy --only functions,firestore:rules`. Ongeza kwanza `firestore.rules.snippet` kwenye rules zako.
7. **Webhook**: kwenye ClickPesa dashboard, weka URL ya `clickpesaWebhook`, kwa mfano
   `https://europe-west1-yaszone.cloudfunctions.net/clickpesaWebhook`.

## Kujaribu sandbox kabla ya deploy

```
cd functions
npm install
npm test                       # majaribio 9 ya ndani
CLICKPESA_CLIENT_ID=... CLICKPESA_API_KEY=... CLICKPESA_CHECKSUM_KEY=... \
  npm run sandbox -- 0712345678 1000
```

## Kuita kutoka kwenye app ya Android (Kotlin)

```kotlin
val functions = Firebase.functions("europe-west1")

// 1. Bei
functions.getHttpsCallable("getRialQuote")
    .call(mapOf("omrAmount" to 50))
    .addOnSuccessListener { r -> val q = r.data as Map<*, *>  /* totalTzs, tzsPerOmr, feeTzs */ }

// 2. Tengeneza oda: inapata control number + USSD push kwa pamoja
functions.getHttpsCallable("createRialOrder").call(mapOf(
    "omrAmount" to 50,
    "payerPhone" to "0712345678",       // hiari: ikiwekwa, PIN inatumwa papo hapo
    "recipient" to mapOf("name" to "Ahmed Said", "bank" to "Bank Muscat", "account" to "0312xxxxxx"),
    "fcmToken" to fcmToken              // push notifications
)).addOnSuccessListener { r ->
    val o = r.data as Map<*, *>
    // Onyesha njia zote mbili kwenye skrini moja:
    // o["billPayNumber"]  -> "Lipa kwa control number"
    // o["ussdSent"]       -> "Angalia simu yako uweke PIN"
    // o["orderRef"], o["totalTzs"], o["message"], o["expiresAt"]
}

// 2b. Kitufe "Tuma PIN tena"
functions.getHttpsCallable("sendUssdPush")
    .call(mapOf("orderRef" to orderRef, "payerPhone" to "0712345678"))

// 3. Fuatilia status kwa wakati halisi
Firebase.firestore.collection("rialOrders").document(orderRef)
    .addSnapshotListener { snap, _ -> val status = snap?.getString("status") }
```

## Mambo ya kujua

- **Control number ni EXACT**: mteja lazima alipe kiasi kamili kwenye control number. Amana inatokea pale tu mteja anapolipa kwa njia zote mbili. Mfumo unaendelea kuangalia malipo ya ziada kwa dakika 30 baada ya oda kulipwa.
- **orderRef** ni herufi na namba tu, kwa mfano `WOR261108K7Q2ZP`, kwa sababu ClickPesa hawakubali alama nyingine. Kila USSD push ina namba yake: `WOR261108K7Q2ZPP1`, `...P2`, `...P3`.
- **Firestore index**: `pollRialOrders` inatafuta oda kwa `paidAt`. Firebase ikiomba index mara ya kwanza, bonyeza link iliyoko kwenye log ili kuitengeneza.
- **Rate inafungwa kwa dakika 15.** Baada ya muda huo, pamoja na dakika 5 za ziada, oda ambayo haijalipwa inakuwa EXPIRED.
- **`ownerTasks`** ni orodha ya oda unazopaswa kulipa Oman. Unaweza kuionyesha kwenye Daftari yako upande wa mmiliki.
- Code hii **haijaunganishwa bado na mfumo wa wateja na salio** wa Daftari. Inatumia collection yake mpya ya `rialOrders`. Ukitaka oda hizi ziingie kwenye salio la mteja na historia ya Daftari, nitumie code ya Daftari tuziunganishe.
