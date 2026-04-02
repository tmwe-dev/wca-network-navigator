import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient } from "jsr:@workingdevshero/deno-imap";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── CA Certificates ── */

const SECTIGO_RSA_DOMAIN_VALIDATION_CA = `-----BEGIN CERTIFICATE-----
MIIGEzCCA/ugAwIBAgIQfVtRJrR2uhHbdBYLvFMNpzANBgkqhkiG9w0BAQwFADCB
iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl
cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV
BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTgx
MTAyMDAwMDAwWhcNMzAxMjMxMjM1OTU5WjCBjzELMAkGA1UEBhMCR0IxGzAZBgNV
BAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UEBxMHU2FsZm9yZDEYMBYGA1UE
ChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFJTQSBEb21haW4g
VmFsaWRhdGlvbiBTZWN1cmUgU2VydmVyIENBMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEA1nMz1tc8INAA0hdFuNY+B6I/x0HuMjDJsGz99J/LEpgPLT+N
TQEMgg8Xf2Iu6bhIefsWg06t1zIlk7cHv7lQP6lMw0Aq6Tn/2YHKHxYyQdqAJrk
jeocgHuP/IJo8lURvh3UGkEC0MpMWCRAIIz7S3YcPb11RFGoKacVPAXJpz9OTTG0E
oKMbgn6xmrntxZ7FN3ifmgg0+1YuWMQJDgZkW7w33PGfKGioVrCSo1yfu4iYCBsk
Haswha6vsC6eep3BwEIc4gLw6uBK0u+QDrTBQBbwb4VCSmT3pDCg/r8uoydajotY
uK3DGReEY+1vVv2Dy2A0xHS+5p3b4eTlygxfFQIDAQABo4IBbjCCAWowHwYDVR0j
BBgwFoAUU3m/WqorSs9UgOHYm8Cd8rIDZsswHQYDVR0OBBYEFI2MXsRUrYrhd+mb
+ZsF4bgBjWHhMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMB0G
A1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjAbBgNVHSAEFDASMAYGBFUdIAAw
CAYGZ4EMAQIBMFAGA1UdHwRJMEcwRaBDoEGGP2h0dHA6Ly9jcmwudXNlcnRydXN0
LmNvbS9VU0VSVHJ1c3RSU0FDZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNybDB2Bggr
BgEFBQcBAQRqMGgwPwYIKwYBBQUHMAKGM2h0dHA6Ly9jcnQudXNlcnRydXN0LmNv
bS9VU0VSVHJ1c3RSU0FBZGRUcnVzdENBLmNydDAlBggrBgEFBQcwAYYZaHR0cDov
L29jc3AudXNlcnRydXN0LmNvbTANBgkqhkiG9w0BAQwFAAOCAgEAMr9hvQ5Iw0/H
ukdN+Jx4GQHcEx2Ab/zDcLRSmjEzmldS+zGea6TvVKqJjUAXaPgREHzSyrHxVYbH
7rM2kYb2OVG/Rr8PoLq0935JxCo2F57kaDl6r5ROVm+yezu/Coa9zcV3HAO4OLGi
H19+24rcRki2aArPsrW04jTkZ6k4Zgle0rj8nSg6F0AnwnJOKf0hPHzPE/uWLMUx
RP0T7dWbqWlod3zu4f+k+TY4CFM5ooQ0nBnzvg6s1SQ36yOoeNDT5++SR2RiOSLv
xvcRviKFxmZEJCaOEDKNyJOuB56DPi/Z+fVGjmO+wea03KbNIaiGCpXZLoUmGv38
sbZXQm2V0TP2ORQGgkE49Y9Y3IBbpNV9lXj9p5v//cWoaasm56ekBYdbqbe4oyAL
l6lFhd2zi+WJN44pDfwGF/Y4QA5C5BIG+3vzxhFoYt/jmPQT2BVPi7Fp2RBgvGQq
6jG35LWjOhSbJuMLe/0CjraZwTiXWTb2qHSihrZe68Zk6s+go/lunrotEbaGmAhY
LcmsJWTyXnW0OMGuf1pGg+pRyrbxmRE1a6Vqe8YAsOf4vmSyrcjC8azjUeqkk+B5
yOGBQMkKW+ESPMFgKuOXwIlCypTPRpgSabuY0MLTDXJLR27lk8QyKGOHQ+SwMj4K
00u/I5sUKUErmgQfky3xxzlIPK1aEn8=
-----END CERTIFICATE-----`;

const USERTRUST_RSA_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIF3jCCA8agAwIBAgIQAf1tMPyjylGoG7xkDjUDLTANBgkqhkiG9w0BAQwFADCB
iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl
cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV
BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAw
MjAxMDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBiDELMAkGA1UEBhMCVVMxEzARBgNV
BAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNleSBDaXR5MR4wHAYDVQQKExVU
aGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMTJVVTRVJUcnVzdCBSU0EgQ2Vy
dGlmaWNhdGlvbiBBdXRob3JpdHkwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
AoICAQCAEmUXNg7D2wiz0KxXDXbtzSfTTK1Qg2HiqiBNCS1kCdzOiZ/MPans9s/B
3PHTsdZ7NygRK0faOca8Ohm0X6a9fZ2jY0K2dvKpOyuR+OJv0OwWIJAJPuLodMkY
tJHUYmTbf6MG8YgYapAiPLz+E/CHFHv25B+O1ORRxhFnRghRy4YUVD+8M/5+bJz/
Fp0YvVGONaanZshyZ9shZrHUm3gDwFA66Mzw3LyeTP6vBZY1H1dat//O+T23LLb2
VN3I5xI6Ta5MirdcmrS3ID3KfyI0rn47aGYBROcBTkZTmzNg95S+UzeQc0PzMsNT
79uq/nROacdrjGCT3sTHDN/hMq7MkztReJVni+49Vv4M0GkPGw/zJSZrM233bkf6
c0Plfg6lZrEpfDKEY1WJxA3Bk1QwGROs0303p+tdOmw1XNtB1xLaqUkL39iAigmT
Yo61Zs8liM2EuLE/pDkP2QKe6xJMlXzzawWpXhaDzLhn4ugTncxbgtNMs+1b/97l
c6wjOy0AvzVVdAlJ2ElYGn+SNuZRkg7zJn0cTRe8yexDJtC/QV9AqURE9JnnV4ee
UB9XVKg+/XRjL7FQZQnmWEIuQxpMtPAlR1n6BB6T1CZGSlCBst6+eLf8ZxXhyVeE
Hg9j1uliutZfVS7qXMYoCAQlObgOK6nyTJccBz8NUvXt7y+CDwIDAQABo0IwQDAd
BgNVHQ4EFgQUU3m/WqorSs9UgOHYm8Cd8rIDZsswDgYDVR0PAQH/BAQDAgEGMA8G
A1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAFzUfA3P9wF9QZllDHPF
Up/L+M+ZBn8b2kMVn54CVVeWFPFSPCeHlCjtHzoBN6J2/FNQwISbxmtOuowhT6KO
VWKR82kV2LyI48SqC/3vqOlLVSoGIG1VeCkZ7l8wXEskEVX/JJpuXior7gtNn3/3
ATiUFJVDBwn7YKnuHKsSjKCaXqeYalltiz8I+8jRRa8YFWSQEg9zKC7F4iRO/Fjs
8PRF/iKz6y+O0tlFYQXBl2+odnKPi4w2r78NBc5xjeambx9spnFixdjQg3IM8WcR
iQycE0xyNN+81XHfqnHd4blsjDwSXWXavVcStkNr/+XeTWYRUc+ZruwXtuhxkYze
Sf7dNXGiFSeUHM9h4ya7b6NnJSFd5t0dCy5oGzuCr+yDZ4XUmFF0sbmZgIn/f3gZ
XHlKYC6SQK5MNyosycdiyA5d9zZbyuAlJQG03RoHnHcAP9Dc1ew91Pq7P8yF1m9/
qS3fuQL39ZeatTXaw2ewh0qpKJ4jjv9cJ2vhsE/zB+4ALtRZh8tSQZXq9EfX7mRB
VXyNWQKV3WKdwrnuWih0hKWbt5DHDAff9Yk2dDLWKMGwsAvgnEzDHNb842m1R0aB
L6KCq9NjRHDEjf8tM7qtj3u1cIiuPhnPQCjY/MiQu12ZIvVS5ljFH4gxQ+6IHdfG
jjxDah2nGN59PRbxYvnKkKj9
-----END CERTIFICATE-----`;

const ACTALIS_INTERMEDIATE_CA = `-----BEGIN CERTIFICATE-----
MIIHdTCCBV2gAwIBAgIQXDs/N638KP4Pz9Or+D+FUTANBgkqhkiG9w0BAQsFADBr
MQswCQYDVQQGEwJJVDEOMAwGA1UEBwwFTWlsYW4xIzAhBgNVBAoMGkFjdGFsaXMg
Uy5wLkEuLzAzMzU4NTIwOTY3MScwJQYDVQQDDB5BY3RhbGlzIEF1dGhlbnRpY2F0
aW9uIFJvb3QgQ0EwHhcNMjAwNzA2MDcyMDU1WhcNMzAwOTIyMTEyMjAyWjCBiTEL
MAkGA1UEBhMCSVQxEDAOBgNVBAgMB0JlcmdhbW8xGTAXBgNVBAcMEFBvbnRlIFNh
biBQaWV0cm8xFzAVBgNVBAoMDkFjdGFsaXMgUy5wLkEuMTQwMgYDVQQDDCtBY3Rh
bGlzIE9yZ2FuaXphdGlvbiBWYWxpZGF0ZWQgU2VydmVyIENBIEczMIICIjANBgkq
hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAs73Ch+t2owm3ayTkyqy0OPuCTiybxTyS
4cU4y0t2RGSwCNjLh/rcutO0yoriZxVtPrNMcIRQ544BQhHFt/ypW7e+t8wWKrHa
r3BkKwSUbqNwpDWP1bXs7IJTVhHXWGAm7Ak1FhrrBmtXk8QtdzTzDDuxfFBK7sCL
N0Jdqoqb1V1z3wsWqAvr4KlSCFW05Nh4baWm/kXOmb8U+XR6kUmuoVvia3iBhotR
TzAHTO9SWWkgjTcir/nhBvyL2RoqkgYyP/k50bznaVOGFnFWzfl0XnrM/salfCBh
O0/1vNaoU8elR6AtbdCFAupgQy95GuFIRVS8n/cF0QupfPjUl+kGSLzvGAc+6oNE
alpAhKIS/+P0uODzRrS9Eq0WX1iSj6KHtQMNN4ZKsS4nsuvYCahnAc0QwQyoduAW
iU/ynhU9WTIEe1VIoEDE79NPOI2/80RqbZqdpAKUaf0FvuqVXhEcjiJJu+d0w9YN
b7gurd6xkaSXemW/fP4idBiNkd8aCVAdshGQYn6yh+na0Lu5IG88Z2kSIFcXDtwy
zjcxkW86pwkO6GekEomVBNKcv0Cey2Smf8uhpZk15TSCeyFDrZBWH9OsDst/Tnhz
pN156Huw3M3RRdEegt33fcyPykgt0HThxrEv9DwOzhs6lCQ5RNQJO7ZvZF1ZiqgT
FOJ6vs1xMqECAwEAAaOCAfQwggHwMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgw
FoAUUtiIOsifeGbtifN7OHCUyQICNtAwQQYIKwYBBQUHAQEENTAzMDEGCCsGAQUF
BzABhiVodHRwOi8vb2NzcDA1LmFjdGFsaXMuaXQvVkEvQVVUSC1ST09UMEUGA1Ud
IAQ+MDwwOgYEVR0gADAyMDAGCCsGAQUFBwIBFiRodHRwczovL3d3dy5hY3RhbGlz
Lml0L2FyZWEtZG93bmxvYWQwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMB
MIHjBgNVHR8EgdswgdgwgZaggZOggZCGgY1sZGFwOi8vbGRhcDA1LmFjdGFsaXMu
aXQvY24lM2RBY3RhbGlzJTIwQXV0aGVudGljYXRpb24lMjBSb290JTIwQ0EsbyUz
ZEFjdGFsaXMlMjBTLnAuQS4lMmYwMzM1ODUyMDk2NyxjJTNkSVQ/Y2VydGlmaWNh
dGVSZXZvY2F0aW9uTGlzdDtiaW5hcnkwPaA7oDmGN2h0dHA6Ly9jcmwwNS5hY3Rh
bGlzLml0L1JlcG9zaXRvcnkvQVVUSC1ST09UL2dldExhc3RDUkwwHQYDVR0OBBYE
FJ+KsbXxsd6C9Cd8vojN3qlDgaNLMA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0B
AQsFAAOCAgEAJbygMnKJ5M6byr5Ectq05ODqwNMtky8TEF3O55g6RHhxblf6OegZ
4ui4+ElHNOIXjycbeuUGuFA4LScCC9fnI1Rnn8TI2Q7OP5YWifEfnrdp99t/tJzQ
hfdi7ZTdRRZZGV9x+grfR/RtjT2C3Lt9X4lcbuSxTea3PHAwwi0A3bYRR1L5ciPm
eAnYtG9kpat8/RuC22oxiZZ5FdjU6wrRWkASRLiIwNcFIYfvpUbMWElaCUhqaB2y
YvWF8o02pnaYb4bvTCg4cVabVnojUuuXH81LeQhhsSXLwcdwSdew0NL4zCiNCn2Q
iDZpz2biCWDggibmWxsUUF6AbqMHnwsdS8vsKXiFQJHeAdNAhA+kwpqYAdhUiCdj
RTUdtRNUucLvZEN1OAvVYyog9xYCfhtkqgXQROMANP+Z/+yaZahaP/Vgak/V00se
Hdh7F+B6h5HVdwdh+17E2jl+aMTfyvBFcg2H/9Qjyl4TY8NW/6v0DPK52sVt8a35
I+7xLGLPohAl4z6pEf2OxgjMNfXXCXS33smRgz1dLQFo8UpAb3rf84zkXaqEI6Qi
2P+5pibVFQigRbn4RcE+K2a/nm2M/o+WZTSio+E+YXacnNk71VcO82biOof+jBKT
iC3Xi7rAlypmme+QFBw9F1J89ig3smV/HaN8tO0lfTpvm7Zvzd5TkMs=
-----END CERTIFICATE-----`;

const ACTALIS_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFuzCCA6OgAwIBAgIIVwoRl0LE48wwDQYJKoZIhvcNAQELBQAwazELMAkGA1UE
BhMCSVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8w
MzM1ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290
IENBMB4XDTExMDkyMjExMjIwMloXDTMwMDkyMjExMjIwMlowazELMAkGA1UEBhMC
SVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8wMzM1
ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290IENB
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAp8bEpSmkLO/lGMWwUKNv
UTufClrJwkg4CsIcoBh/kbWHuUA/3R1oHwiD1S0eiKD4j1aPbZkCkpAW1V8IbInX
4ay8IMKx4INRimlNAJZaby/ARH6jDuSRzVju3PvHHkVH3Se5CAGfpiEd9UEtL0z9
KK3giq0itFZljoZUj5NDKd45RnijMCO6zfB9E1fAXdKDa0hMxKufgFpbOr3JpyI/
gCczWw63igxdBzcIy2zSekciRDXFzMwujt0q7bd9Zg1fYVEiVRvjRuPjPdA1Yprb
rxTIW6HMiRvhMCb8oJsfgadHHwTrozmSBp+Z07/T6k9QnBn+locePGX2oxgkg4YQ
51Q+qDp2JE+BIcXjDwL4k5RHILv+1A7TaLndxHqEguNTVHnd25zS8gebLra8Pu2F
be8lEfKXGkJh90qX6IuxEAf6ZYGyojnP9zz/GPvG8VqLWeICrHuS0E4UT1lF9gxe
KF+w6D9Fz8+vm2/7hNN3WpVvrJSEnu68wEqPSpP4RCHiMUVhUE4Q2OM1fEwZtN4F
v6MGn8i1zeQf1xcGDXqVdFUNaBr8EBtiZJ1t4JWgw5QHVw0U5r0F+7if5t+L4sbn
fpb2U8WANFAoWPASUHEXMLrmeGO89LKtmyuy/uE5jF66CyCU3nuDuP/jVo23Eek7
jPKxwV2dpAtMK9myGPW1n0sCAwEAAaNjMGEwHQYDVR0OBBYEFFLYiDrIn3hm7Ynz
ezhwlMkCAjbQMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAUUtiIOsifeGbt
ifN7OHCUyQICNtAwDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3DQEBCwUAA4ICAQAL
e3KHwGCmSUyIWOYdiPcUZEim2FgKDk8TNd81HdTtBjHIgT5q1d07GjLukD0R0i70
jsNjLiNmsGe+b7bAEzlgqqI0JZN1Ut6nna0Oh4lScWoWPBkdg/iaKWW+9D+a2fDz
WochcYBNy+A4mz+7+uAwTc+G02UQGRjRlwKxK3JCaKygvU5a2hi/a5iB0P2avl4V
SM0RFbnAKVy06Ij3Pjaut2L9HmLecHgQHEhb2rykOLpn7VU+Xlff1ANATIGk0k9j
pwlCCRT8AKnCgHNPLsBA2RF7SOp6AsDT6ygBJlh0wcBzIm2Tlf05fbsq4/aC4yyX
X04fkZT6/iyj2HYauE2yOE+b+h1IYHkm4vP9qdCa6HCPSXrW5b0KDtst842/6+Ok
fcvHlXHo2qN8xcL4dJIEG4aspCJTQLas/kx2z/uUMsA1n3Y/buWQbqCmJqK4LL7R
K4X9p2jIugErsWx0Hbhzlefut8cl8ABMALJ+tguLHPPAUJ4lueAI3jZm/zel0btU
ZCzJJ7VLkn5l/9Mt4blOvH+kQSGQQXemOR/qnuOf0GZvBeyqdn6/axag67XH/JJU
LysRJyU3eExRarDzzFhdFPFqSBX/wge2sY0PjlxQRrM9vwGYT7JZVEc+NHt4bVaT
LnPqZih4zR0Uv6CPLy64Lo7yFIrM6bV8+2ydDKXhlg==
-----END CERTIFICATE-----`;

function getCaCertsForHost(host: string): string[] {
  const h = host.trim().toLowerCase();
  if (h.endsWith(".vmteca.net") || h === "vmteca.net") {
    return [SECTIGO_RSA_DOMAIN_VALIDATION_CA, USERTRUST_RSA_ROOT_CA];
  }
  return [ACTALIS_INTERMEDIATE_CA, ACTALIS_ROOT_CA];
}

/* ── Sender matching ── */

async function matchSender(supabase: any, email: string) {
  if (!email || email === "@" || !email.includes("@")) return { source_type: "unknown", source_id: null, partner_id: null, name: email || "sconosciuto" };
  const emailLower = email.toLowerCase();
  const domain = emailLower.split("@")[1];

  const { data: partner } = await supabase.from("partners").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };
  const { data: pc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };
  const { data: ic } = await supabase.from("imported_contacts").select("id, company_name, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };
  const { data: prospect } = await supabase.from("prospects").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };

  if (domain) {
    const domainPattern = `%@${domain}`;
    const { data: dp } = await supabase.from("partners").select("id, company_name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dp) return { source_type: "partner", source_id: dp.id, partner_id: dp.id, name: dp.company_name };
    const { data: dpc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dpc) return { source_type: "partner_contact", source_id: dpc.id, partner_id: dpc.partner_id, name: dpc.name };
  }

  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

/* ── Helper: extract email from envelope address ── */
function envelopeAddr(addr: any): string {
  if (!addr) return "";
  const mb = addr.mailbox || "";
  const host = addr.host || "";
  if (mb && host) return `${mb}@${host}`.toLowerCase();
  return "";
}

/* ── Helper: find text section in bodyStructure ── */
function findTextSection(bs: any, prefix = ""): { section: string; type: string } | null {
  if (!bs) return null;
  
  // Single part message
  if (bs.type && !bs.childNodes) {
    const mimeType = `${bs.type}/${bs.subtype || ""}`.toLowerCase();
    if (mimeType === "text/plain") return { section: prefix || "1", type: "plain" };
    if (mimeType === "text/html") return { section: prefix || "1", type: "html" };
    return null;
  }
  
  // Multipart — look through children
  if (bs.childNodes && Array.isArray(bs.childNodes)) {
    let plainResult: { section: string; type: string } | null = null;
    let htmlResult: { section: string; type: string } | null = null;
    
    for (let i = 0; i < bs.childNodes.length; i++) {
      const child = bs.childNodes[i];
      const childPrefix = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      const result = findTextSection(child, childPrefix);
      if (result) {
        if (result.type === "plain" && !plainResult) plainResult = result;
        if (result.type === "html" && !htmlResult) htmlResult = result;
      }
    }
    // Prefer plain text, fall back to HTML
    return plainResult || htmlResult;
  }
  
  return null;
}

/* ── BATCH SIZE ── */
const BATCH_SIZE = 3;

/* ── Main handler ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // IMAP credentials
    const imapHost = Deno.env.get("IMAP_HOST") || "imaps.aruba.it";
    const imapUser = Deno.env.get("IMAP_USER");
    const imapPass = Deno.env.get("IMAP_PASSWORD");
    if (!imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "Credenziali IMAP non configurate" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sync state
    let { data: syncState } = await supabase.from("email_sync_state").select("*").eq("user_id", userId).maybeSingle();
    if (!syncState) {
      const { data: ns } = await supabase.from("email_sync_state").insert({ user_id: userId, imap_host: imapHost, imap_user: imapUser, last_uid: 0 }).select().single();
      syncState = ns;
    }
    const lastUid = syncState?.last_uid || 0;

    console.log(`[check-inbox] Connecting to ${imapHost}:993...`);

    const client = new ImapClient({
      host: imapHost,
      port: 993,
      tls: true,
      username: imapUser,
      password: imapPass,
      authMechanism: "LOGIN",
      autoReconnect: false,
      commandTimeout: 30000,
      connectionTimeout: 15000,
      tlsOptions: { caCerts: getCaCertsForHost(imapHost) },
    });

    await client.connect();
    await client.authenticate();
    console.log("[check-inbox] Authenticated OK");

    const inbox = await client.selectMailbox("INBOX");
    console.log(`[check-inbox] INBOX: ${inbox.exists} messages`);

    // Search for new UIDs
    let uids: number[] = [];
    try {
      const searchCmd = lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : `UID SEARCH ALL`;
      const searchResponse = await (client as any).executeCommand(searchCmd);
      for (const line of searchResponse) {
        if (typeof line === "string" && line.startsWith("* SEARCH")) {
          uids = line.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean).map(Number);
          break;
        }
      }
      if (lastUid > 0) {
        uids = uids.filter(u => u > lastUid);
      }
    } catch (searchErr: any) {
      console.error("[check-inbox] UID SEARCH error:", searchErr.message);
      uids = [];
    }

    console.log(`[check-inbox] Found ${uids.length} new UIDs`);
    const toFetch = uids.sort((a, b) => a - b).slice(0, BATCH_SIZE);

    const messages: any[] = [];
    let maxUid = lastUid;

    if (toFetch.length > 0) {
      for (const uid of toFetch) {
        try {
          // Step 1: Fetch ENVELOPE only (lightweight — no body data)
          const envFetch = await client.fetch(String(uid), {
            byUid: true,
            uid: true,
            envelope: true,
            bodyStructure: true,
          } as any);

          const msg = envFetch?.[0];
          if (!msg) {
            console.warn(`[check-inbox] No data for UID ${uid}, skipping`);
            continue;
          }

          const env = msg.envelope || {};
          const fromAddr = envelopeAddr(env.from?.[0]) || "sconosciuto@unknown";
          const toAddr = envelopeAddr(env.to?.[0]) || "";
          const senderName = env.from?.[0]?.name || fromAddr;
          const subject = env.subject || "(nessun oggetto)";
          const messageId = env.messageId || `uid_${uid}_${Date.now()}`;
          const date = env.date || "";
          const inReplyTo = env.inReplyTo || null;

          // Step 2: Find text section in bodyStructure and fetch it
          let bodyText = "";
          let bodyHtml = "";
          let attachmentCount = 0;
          const bs = msg.bodyStructure;

          // Count attachments from bodyStructure
          function countAttachments(node: any): number {
            if (!node) return 0;
            if (node.childNodes && Array.isArray(node.childNodes)) {
              let count = 0;
              for (const child of node.childNodes) count += countAttachments(child);
              return count;
            }
            const mime = `${node.type || ""}/${node.subtype || ""}`.toLowerCase();
            if (mime !== "text/plain" && mime !== "text/html" && node.disposition?.type?.toLowerCase() !== "inline") {
              return 1;
            }
            return 0;
          }
          attachmentCount = countAttachments(bs);

          // Find text body section
          const textSection = findTextSection(bs);
          if (textSection) {
            try {
              // Fetch just the text section via raw IMAP command
              const bodyCmd = `UID FETCH ${uid} (BODY.PEEK[${textSection.section}])`;
              const bodyResponse = await (client as any).executeCommand(bodyCmd);
              
              // Parse the literal response — look for the text content
              let textContent = "";
              let capturing = false;
              for (const line of bodyResponse) {
                if (typeof line === "string") {
                  // Check for literal start like: * 1 FETCH (... {1234}
                  if (line.includes(`BODY[${textSection.section}]`) && line.includes("{")) {
                    capturing = true;
                    continue;
                  }
                  if (capturing) {
                    // End of literal — line with just ")"
                    if (line.trim() === ")" || line.match(/^\S+ OK/)) {
                      capturing = false;
                    } else {
                      textContent += line + "\n";
                    }
                  }
                } else if (line instanceof Uint8Array) {
                  textContent += new TextDecoder().decode(line);
                }
              }

              if (textContent) {
                if (textSection.type === "plain") {
                  bodyText = textContent.trim().slice(0, 50000);
                } else {
                  bodyHtml = textContent.trim().slice(0, 100000);
                }
              }
            } catch (bodyErr: any) {
              console.warn(`[check-inbox] Body fetch error UID ${uid} section ${textSection.section}:`, bodyErr.message);
            }
          }

          // Also try to get HTML if we only got plain
          if (bodyText && !bodyHtml && bs) {
            const htmlSection = findTextSection(bs);
            // Already handled above — skip double fetch for now
          }

          console.log(`[check-inbox] UID ${uid}: from=${fromAddr}, text=${bodyText.length}c, html=${bodyHtml.length}c, att=${attachmentCount}, subj: ${subject}`);

          const match = await matchSender(supabase, fromAddr);

          const msgData = {
            user_id: userId,
            channel: "email",
            direction: "inbound",
            source_type: match.source_type,
            source_id: match.source_id,
            partner_id: match.partner_id,
            from_address: fromAddr,
            to_address: toAddr,
            subject,
            body_text: bodyText,
            body_html: bodyHtml,
            message_id_external: messageId,
            in_reply_to: inReplyTo,
            raw_payload: { uid, date, sender_name: match.name || senderName, attachment_count: attachmentCount },
          };

          // Save immediately (checkpoint per message)
          const { error: saveErr } = await supabase
            .from("channel_messages")
            .upsert([msgData], { onConflict: "message_id_external" });
          
          if (saveErr) {
            console.error(`[check-inbox] Save error UID ${uid}:`, saveErr.message);
          } else {
            messages.push(msgData);
            maxUid = uid;
            
            // Checkpoint: update last_uid after each successful save
            await supabase
              .from("email_sync_state")
              .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
              .eq("user_id", userId);

            // Increment interaction count for known contacts
            if (match.source_type === "imported_contact" && match.source_id) {
              await supabase.rpc("increment_contact_interaction", { p_contact_id: match.source_id });
            }
          }

        } catch (e: any) {
          console.error(`[check-inbox] Error processing UID ${uid}:`, e.message);
        }
      }
    }

    // Disconnect
    try { client.disconnect(); } catch (_) { /* ignore */ }

    const matched = messages.filter(m => m.source_type !== "unknown").length;

    return new Response(JSON.stringify({
      success: true,
      total: messages.length,
      matched,
      unmatched: messages.length - matched,
      last_uid: maxUid,
      remaining: Math.max(0, uids.length - BATCH_SIZE),
      messages: messages.map(m => ({
        from: m.from_address,
        subject: m.subject,
        source_type: m.source_type,
        sender_name: m.raw_payload?.sender_name,
        date: m.raw_payload?.date,
        has_body: !!(m.body_text || m.body_html),
        body_text_length: m.body_text?.length || 0,
        body_html_length: m.body_html?.length || 0,
        attachment_count: m.raw_payload?.attachment_count || 0,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[check-inbox] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
