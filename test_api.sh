#!/bin/bash
curl -s -X POST 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' \
  -H 'Origin: https://satsuitequestionbank.collegeboard.org' \
  -H 'Referer: https://satsuitequestionbank.collegeboard.org/' \
  -d '{"asmtEventId":99,"test":2,"domain":"H,P,Q,S"}' | head -c 2000
echo ""
echo "Done"
