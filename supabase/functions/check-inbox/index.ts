import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, decodeAttachment } from "jsr:@workingdevshero/deno-imap";

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

/* ══════════════════════════════════════════════════════════════
   RFC 2045/2046 — Content-Transfer-Encoding & Charset
   ══════════════════════════════════════════════════════════════ */

function normalizeCharset(charset?: string | null): string {
  const value = (charset || "utf-8").trim().toLowerCase();
  if (value === "utf8") return "utf-8";
  if (value === "us-ascii" || value === "ascii") return "utf-8";
  if (value === "latin1" || value === "iso_8859-1") return "iso-8859-1";
  if (value === "latin2" || value === "iso_8859-2") return "iso-8859-2";
  if (value === "windows-1252" || value === "cp1252") return "windows-1252";
  return value;
}

/**
 * RFC 2045 §6.7 — Proper Quoted-Printable decoder.
 * Handles soft line breaks (=\r\n or =\n) and =XX hex escapes.
 */
function decodeQuotedPrintable(input: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < input.length) {
    const byte = input[i];
    if (byte === 0x3D) { // '='
      // Soft line break: =\r\n or =\n
      if (i + 1 < input.length && input[i + 1] === 0x0A) {
        i += 2; continue;
      }
      if (i + 2 < input.length && input[i + 1] === 0x0D && input[i + 2] === 0x0A) {
        i += 3; continue;
      }
      // Hex escape: =XX
      if (i + 2 < input.length) {
        const hi = input[i + 1];
        const lo = input[i + 2];
        const hex = String.fromCharCode(hi, lo);
        const val = parseInt(hex, 16);
        if (!isNaN(val)) {
          result.push(val);
          i += 3; continue;
        }
      }
      // Malformed =, pass through
      result.push(byte);
      i++;
    } else {
      result.push(byte);
      i++;
    }
  }
  return new Uint8Array(result);
}

/**
 * RFC 2045 §6.8 — Base64 decoder (using built-in atob).
 */
function decodeBase64Bytes(input: Uint8Array): Uint8Array {
  // Strip whitespace and decode
  const str = new TextDecoder("ascii").decode(input).replace(/[\r\n\s]/g, "");
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return input; // Return as-is if invalid base64
  }
}

/**
 * RFC 2045 §6 — Decode Content-Transfer-Encoding then convert charset to UTF-8.
 * Custom implementation for text parts; uses library for binary attachments.
 */
function decodeMimePart(rawBytes: Uint8Array, encoding: string, charset?: string | null): string {
  const enc = (encoding || "7BIT").toUpperCase();
  let decoded: Uint8Array;

  switch (enc) {
    case "QUOTED-PRINTABLE":
      decoded = decodeQuotedPrintable(rawBytes);
      break;
    case "BASE64":
      decoded = decodeBase64Bytes(rawBytes);
      break;
    default: // 7BIT, 8BIT, BINARY
      decoded = rawBytes;
  }

  const cs = normalizeCharset(charset);
  try {
    return new TextDecoder(cs).decode(decoded);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(decoded);
  }
}

/* ══════════════════════════════════════════════════════════════
   RFC 3501 §6.4.5 — BODYSTRUCTURE navigation
   ══════════════════════════════════════════════════════════════ */

type MimeLeafPart = {
  section: string;
  type: string;       // e.g. "text"
  subtype: string;    // e.g. "plain", "html", "png"
  encoding: string;   // Content-Transfer-Encoding
  charset: string;
  contentId: string;  // RFC 2392 — Content-ID for inline images
  dispositionType: string;
  filename: string;
  size: number;
  isInlineBody: boolean;   // text/plain or text/html meant for rendering
  isInlineImage: boolean;  // image with Content-ID (cid:)
  isAttachment: boolean;   // everything else
};

function getPartParameter(params: Record<string, string> | undefined, key: string): string {
  if (!params) return "";
  const found = Object.entries(params).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found?.[1] || "";
}

function getPartFilename(part: any): string {
  return (
    getPartParameter(part?.dispositionParameters, "filename") ||
    getPartParameter(part?.dispositionParameters, "filename*") ||
    getPartParameter(part?.parameters, "name") ||
    getPartParameter(part?.parameters, "name*") ||
    ""
  );
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").slice(0, 180) || "attachment.bin";
}

/** Sanitize messageId for use as storage path segment */
function sanitizeMessageId(mid: string): string {
  return mid.replace(/[<>]/g, "").replace(/[@\/\\:*?"|\x00-\x1F]/g, "_").slice(0, 120) || "unknown";
}

/**
 * RFC 2046 — Recursively walk the BODYSTRUCTURE tree and collect leaf parts
 * with their IMAP section numbers.
 */
function collectMimeLeafParts(part: any, path: string = ""): MimeLeafPart[] {
  if (!part) return [];

  // Multipart container — recurse into children
  if (Array.isArray(part.childParts) && part.childParts.length > 0) {
    return part.childParts.flatMap((child: any, index: number) =>
      collectMimeLeafParts(child, path ? `${path}.${index + 1}` : `${index + 1}`)
    );
  }

  const type = (part.type || "").toLowerCase();
  const subtype = (part.subtype || "").toLowerCase();
  const dispositionType = (part.dispositionType || "").toLowerCase();
  const filename = getPartFilename(part);
  const charset = getPartParameter(part.parameters, "charset") || "utf-8";
  const contentId = (part.id || "").replace(/[<>]/g, "");
  const section = path || "1";
  const encoding = (part.encoding || "7BIT").toUpperCase();

  // RFC 2822 — attached message/rfc822
  if (type === "message" && subtype === "rfc822") {
    const isAttachedMessage = dispositionType === "attachment" || !!filename;
    if (isAttachedMessage || !part.messageBodyStructure) {
      return [{
        section, type, subtype, encoding, charset, contentId, dispositionType,
        filename: filename || `message-${section}.eml`,
        size: part.size || 0,
        isInlineBody: false, isInlineImage: false, isAttachment: true,
      }];
    }
    return collectMimeLeafParts(part.messageBodyStructure, section);
  }

  // Classify the part
  const isTextBody =
    type === "text" &&
    (subtype === "plain" || subtype === "html") &&
    dispositionType !== "attachment" &&
    !filename;

  const isInlineImage =
    type === "image" &&
    !!contentId &&
    dispositionType !== "attachment";

  return [{
    section, type, subtype, encoding, charset, contentId, dispositionType,
    filename: filename || (isTextBody ? "" : `${type}_${subtype}.${subtype}`),
    size: part.size || 0,
    isInlineBody: isTextBody,
    isInlineImage,
    isAttachment: !isTextBody && !isInlineImage,
  }];
}

/* ══════════════════════════════════════════════════════════════
   Sender matching (domain fallback)
   ══════════════════════════════════════════════════════════════ */

async function matchSender(supabase: any, email: string) {
  if (!email || email === "@" || !email.includes("@")) 
    return { source_type: "unknown", source_id: null, partner_id: null, name: email || "sconosciuto" };
  
  const emailLower = email.toLowerCase();
  const domain = emailLower.split("@")[1];

  // Exact email match
  const { data: partner } = await supabase.from("partners").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };
  const { data: pc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };
  const { data: ic } = await supabase.from("imported_contacts").select("id, company_name, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };
  const { data: prospect } = await supabase.from("prospects").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };

  // Domain fallback
  if (domain) {
    const domainPattern = `%@${domain}`;
    const { data: dp } = await supabase.from("partners").select("id, company_name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dp) return { source_type: "partner", source_id: dp.id, partner_id: dp.id, name: dp.company_name };
    const { data: dpc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dpc) return { source_type: "partner_contact", source_id: dpc.id, partner_id: dpc.partner_id, name: dpc.name };
  }

  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

/* ══════════════════════════════════════════════════════════════
   IMAP response parsing helpers
   ══════════════════════════════════════════════════════════════ */

function envelopeAddr(addr: any): string {
  if (!addr) return "";
  const mb = addr.mailbox || "";
  const host = addr.host || "";
  if (mb && host) return `${mb}@${host}`.toLowerCase();
  return "";
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function extractLiteralBytesFromResponse(lines: any[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  let literalStarted = false;

  for (const line of lines) {
    if (line instanceof Uint8Array) {
      literalStarted = true;
      chunks.push(line);
      continue;
    }
    if (typeof line !== "string") continue;
    if (/\{\d+\}\s*$/.test(line)) {
      literalStarted = true;
      continue;
    }
    if (!literalStarted) continue;
    if (/^\* \d+ FETCH/.test(line)) continue;
    if (line.trim() === ")" || /^\S+ OK/.test(line)) continue;
    chunks.push(encoder.encode(line + "\n"));
  }
  return concatBytes(chunks);
}

function extractLiteralTextFromResponse(lines: any[]): string {
  return new TextDecoder().decode(extractLiteralBytesFromResponse(lines)).trim();
}

function parseRawHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    if (line.match(/^\s/) && currentKey) {
      currentValue += " " + line.trim();
    } else {
      if (currentKey) headers[currentKey.toLowerCase()] = currentValue.trim();
      const match = line.match(/^([A-Za-z\-]+):\s*(.*)/);
      if (match) {
        currentKey = match[1];
        currentValue = match[2];
      } else {
        currentKey = "";
        currentValue = "";
      }
    }
  }
  if (currentKey) headers[currentKey.toLowerCase()] = currentValue.trim();
  return headers;
}

function parseEmailFromHeader(header: string): string {
  if (!header) return "";
  const angleMatch = header.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].toLowerCase();
  const trimmed = header.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return "";
}

/* ══════════════════════════════════════════════════════════════
   BATCH SIZE — 1 email per invocation
   ══════════════════════════════════════════════════════════════ */
const BATCH_SIZE = 1;

/* Max attachment size to download (5MB) — skip larger ones */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/* ══════════════════════════════════════════════════════════════
   Main handler
   ══════════════════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");
    const userId = user.id;

    // Get IMAP credentials
    const imapHost = Deno.env.get("IMAP_HOST") || "";
    const imapUser = Deno.env.get("IMAP_USER") || "";
    const imapPassword = Deno.env.get("IMAP_PASSWORD") || "";
    if (!imapHost || !imapUser || !imapPassword) throw new Error("IMAP credentials not configured");

    // Get sync state
    const { data: syncState } = await supabase
      .from("email_sync_state")
      .select("last_uid")
      .eq("user_id", userId)
      .maybeSingle();

    let lastUid = syncState?.last_uid || 0;

    // Ensure sync state row exists
    if (!syncState) {
      await supabase.from("email_sync_state").upsert({
        user_id: userId,
        last_uid: 0,
        imap_host: imapHost,
        imap_user: imapUser,
      }, { onConflict: "user_id" });
    }

    // Connect to IMAP
    const client = new ImapClient({
      host: imapHost,
      port: 993,
      username: imapUser,
      password: imapPassword,
      secure: true,
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
          /* ─── Step 1: ENVELOPE + BODYSTRUCTURE (RFC 3501 §6.4.5) ─── */
          let fromAddr = "";
          let toAddr = "";
          let senderName = "";
          let subject = "(nessun oggetto)";
          let messageId = `uid_${uid}_${Date.now()}`;
          let date = "";
          let inReplyTo: string | null = null;
          let bodyStructure: any = null;

          try {
            const envFetch = await client.fetch(String(uid), {
              byUid: true,
              uid: true,
              envelope: true,
              bodyStructure: true,
            } as any);

            const env = envFetch?.[0]?.envelope;
            bodyStructure = envFetch?.[0]?.bodyStructure || null;
            if (env) {
              fromAddr = envelopeAddr(env.from?.[0]);
              toAddr = envelopeAddr(env.to?.[0]);
              senderName = env.from?.[0]?.name || fromAddr;
              subject = env.subject || "(nessun oggetto)";
              messageId = env.messageId ? sanitizeMessageId(env.messageId) : messageId;
              date = env.date || "";
              inReplyTo = env.inReplyTo || null;
            }
          } catch (envErr: any) {
            console.warn(`[check-inbox] Envelope/bodyStructure error UID ${uid}:`, envErr.message);
          }

          /* ─── Step 1b: Fallback to raw HEADER.FIELDS (RFC 2822) ─── */
          if (!fromAddr || fromAddr === "@" || fromAddr === "sconosciuto@unknown") {
            try {
              const hdrCmd = `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)])`;
              const hdrResponse = await (client as any).executeCommand(hdrCmd);
              const rawHeaders = extractLiteralTextFromResponse(hdrResponse);
              if (rawHeaders) {
                const parsed = parseRawHeaders(rawHeaders);
                const rawFrom = parseEmailFromHeader(parsed["from"] || "");
                if (rawFrom && rawFrom !== "@") fromAddr = rawFrom;
                if (!toAddr || toAddr === "@") toAddr = parseEmailFromHeader(parsed["to"] || "");
                if (subject === "(nessun oggetto)" && parsed["subject"]) subject = parsed["subject"];
                if (!date && parsed["date"]) date = parsed["date"];
                if (messageId.startsWith("uid_") && parsed["message-id"]) {
                  messageId = sanitizeMessageId(parsed["message-id"]);
                }
                if (!inReplyTo && parsed["in-reply-to"]) {
                  inReplyTo = parsed["in-reply-to"].replace(/[<>]/g, "");
                }
                const rawFromFull = parsed["from"] || "";
                const nameMatch = rawFromFull.match(/^"?([^"<]+)"?\s*</);
                if (nameMatch) senderName = nameMatch[1].trim();
                else senderName = fromAddr;
                console.log(`[check-inbox] UID ${uid}: raw header fallback from=${fromAddr}`);
              }
            } catch (hdrErr: any) {
              console.warn(`[check-inbox] Raw header fetch error UID ${uid}:`, hdrErr.message);
            }
          }

          if (!fromAddr || fromAddr === "@") {
            fromAddr = "sconosciuto@unknown";
          }

          /* ─── Step 2: Parse BODYSTRUCTURE into typed parts (RFC 2046) ─── */
          let bodyText = "";
          let bodyHtml = "";
          const attachmentRecords: any[] = [];

          // Collect all MIME leaf parts from BODYSTRUCTURE
          let parts: MimeLeafPart[] = [];
          if (bodyStructure) {
            try {
              parts = collectMimeLeafParts(bodyStructure);
              console.log(`[check-inbox] UID ${uid}: ${parts.length} MIME parts found`);
            } catch (bsErr: any) {
              console.warn(`[check-inbox] UID ${uid}: BODYSTRUCTURE parse failed:`, bsErr.message);
            }
          }

          // If BODYSTRUCTURE gave us nothing, try fetching RFC822.TEXT as fallback
          if (parts.length === 0) {
            try {
              const rfc822Cmd = `UID FETCH ${uid} (BODY.PEEK[TEXT])`;
              const rfc822Response = await (client as any).executeCommand(rfc822Cmd);
              const rawText = extractLiteralTextFromResponse(rfc822Response);
              if (rawText && rawText.length > 5) {
                bodyText = rawText.slice(0, 50_000);
                console.log(`[check-inbox] UID ${uid}: used RFC822.TEXT fallback (${bodyText.length}c)`);
              }
            } catch (fallbackErr: any) {
              console.warn(`[check-inbox] UID ${uid}: RFC822.TEXT fallback failed:`, fallbackErr.message);
            }
            // Still add a dummy part to skip the loop below
            parts = [];
          }

          /* ─── Step 3: Fetch each part with proper decoding (RFC 2045) ─── */
          for (const part of parts) {

            // === 3a: Inline body parts (text/plain, text/html) ===
            if (part.isInlineBody) {
              const target = part.subtype === "html" ? "html" : "text";
              // Skip if we already have this type
              if (target === "html" && bodyHtml) continue;
              if (target === "text" && bodyText) continue;

              try {
                const bodyCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const bodyResponse = await (client as any).executeCommand(bodyCmd);
                const rawBytes = extractLiteralBytesFromResponse(bodyResponse);

                if (rawBytes.length > 5) {
                  // RFC 2045 — Decode transfer encoding + charset
                  const decoded = decodeMimePart(rawBytes, part.encoding, part.charset);

                  if (target === "html") {
                    bodyHtml = decoded.slice(0, 100_000);
                  } else {
                    bodyText = decoded.slice(0, 50_000);
                  }
                }
              } catch (bodyErr: any) {
                console.warn(`[check-inbox] UID ${uid} body section ${part.section} error:`, bodyErr.message);
              }
              continue;
            }

            // === 3b: Inline images with Content-ID (RFC 2392 — cid:) ===
            if (part.isInlineImage && part.contentId) {
              if (part.size > MAX_ATTACHMENT_BYTES) {
                console.log(`[check-inbox] UID ${uid}: skipping large inline image ${part.contentId} (${part.size}B)`);
                continue;
              }

              try {
                const imgCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const imgResponse = await (client as any).executeCommand(imgCmd);
                const rawBytes = extractLiteralBytesFromResponse(imgResponse);

                if (rawBytes.length > 0) {
                  // Decode transfer encoding (base64 for images)
                  const decoded: Uint8Array = decodeAttachment(rawBytes, part.encoding);
                  const contentType = `${part.type}/${part.subtype}`;
                  const ext = part.subtype === "jpeg" ? "jpg" : part.subtype;
                  const filename = sanitizeFilename(part.filename || `inline_${part.contentId}.${ext}`);
                  const storagePath = `emails/${userId}/${messageId}/${filename}`;

                  // Upload to Storage
                  const { error: uploadErr } = await supabase.storage
                    .from("import-files")
                    .upload(storagePath, decoded, { contentType, upsert: true });

                  if (!uploadErr) {
                    const { data: urlData } = supabase.storage
                      .from("import-files")
                      .getPublicUrl(storagePath);

                    // We'll replace cid: references in the HTML after all parts are processed
                    attachmentRecords.push({
                      cid: part.contentId,
                      publicUrl: urlData?.publicUrl || "",
                      filename,
                      storagePath,
                      contentType,
                      size: decoded.length,
                      isInline: true,
                    });
                  } else {
                    console.warn(`[check-inbox] UID ${uid}: inline image upload failed:`, uploadErr.message);
                  }
                }
              } catch (imgErr: any) {
                console.warn(`[check-inbox] UID ${uid} inline image ${part.section} error:`, imgErr.message);
              }
              continue;
            }

            // === 3c: Attachments (PDF, DOC, XLS, images without cid, etc.) ===
            if (part.isAttachment && part.filename) {
              if (part.size > MAX_ATTACHMENT_BYTES) {
                console.log(`[check-inbox] UID ${uid}: skipping large attachment ${part.filename} (${part.size}B)`);
                // Still record metadata even if we don't download
                attachmentRecords.push({
                  filename: sanitizeFilename(part.filename),
                  storagePath: "",
                  contentType: `${part.type}/${part.subtype}`,
                  size: part.size,
                  isInline: false,
                  skipped: true,
                });
                continue;
              }

              try {
                const attCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const attResponse = await (client as any).executeCommand(attCmd);
                const rawBytes = extractLiteralBytesFromResponse(attResponse);

                if (rawBytes.length > 0) {
                  const decoded: Uint8Array = decodeAttachment(rawBytes, part.encoding);
                  const contentType = `${part.type}/${part.subtype}`;
                  const filename = sanitizeFilename(part.filename);
                  const storagePath = `emails/${userId}/${messageId}/${filename}`;

                  const { error: uploadErr } = await supabase.storage
                    .from("import-files")
                    .upload(storagePath, decoded, { contentType, upsert: true });

                  if (!uploadErr) {
                    attachmentRecords.push({
                      filename,
                      storagePath,
                      contentType,
                      size: decoded.length,
                      isInline: false,
                    });
                  } else {
                    console.warn(`[check-inbox] UID ${uid}: attachment upload failed:`, uploadErr.message);
                  }
                }
              } catch (attErr: any) {
                console.warn(`[check-inbox] UID ${uid} attachment ${part.section} error:`, attErr.message);
              }
            }
          }

          /* ─── Step 4: Replace cid: references in HTML (RFC 2392) ─── */
          if (bodyHtml) {
            for (const att of attachmentRecords) {
              if (att.isInline && att.cid && att.publicUrl) {
                // Replace both cid:xxx and cid:xxx formats
                bodyHtml = bodyHtml.replace(
                  new RegExp(`cid:${att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
                  att.publicUrl
                );
              }
            }
          }

          console.log(`[check-inbox] UID ${uid}: from=${fromAddr}, text=${bodyText.length}c, html=${bodyHtml.length}c, attachments=${attachmentRecords.length}, subj: ${subject}`);

          /* ─── Step 5: Match sender ─── */
          const match = await matchSender(supabase, fromAddr);

          /* ─── Step 6: Save message (checkpoint) ─── */
          // Parse email_date from envelope date string
          let emailDate: string | null = null;
          if (date) {
            try {
              const parsed = new Date(date);
              if (!isNaN(parsed.getTime())) emailDate = parsed.toISOString();
            } catch { /* ignore */ }
          }

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
            email_date: emailDate,
            raw_payload: { uid, date, sender_name: match.name || senderName },
          };

          const { data: savedMsg, error: saveErr } = await supabase
            .from("channel_messages")
            .upsert([msgData], { onConflict: "message_id_external" })
            .select("id")
            .single();

          if (saveErr) {
            console.error(`[check-inbox] Save error UID ${uid}:`, saveErr.message);
          } else {
            messages.push(msgData);
            maxUid = uid;

            // Save attachment records to email_attachments table
            if (savedMsg?.id && attachmentRecords.length > 0) {
              const attRows = attachmentRecords
                .filter(a => !a.skipped && a.storagePath)
                .map(a => ({
                  message_id: savedMsg.id,
                  user_id: userId,
                  filename: a.filename,
                  storage_path: a.storagePath,
                  content_type: a.contentType,
                  size_bytes: a.size,
                }));

              if (attRows.length > 0) {
                const { error: attSaveErr } = await supabase
                  .from("email_attachments")
                  .insert(attRows);
                if (attSaveErr) {
                  console.warn(`[check-inbox] UID ${uid}: attachment DB save error:`, attSaveErr.message);
                } else {
                  console.log(`[check-inbox] UID ${uid}: saved ${attRows.length} attachments to DB`);
                }
              }
            }

            // Checkpoint: update last_uid
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
          // Advance past this UID to avoid getting stuck
          if (uid > maxUid) {
            maxUid = uid;
            await supabase
              .from("email_sync_state")
              .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
              .eq("user_id", userId);
          }
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
