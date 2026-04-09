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
  if (value === "windows-1250" || value === "cp1250") return "windows-1250";
  if (value === "windows-1251" || value === "cp1251") return "windows-1251";
  if (value === "iso-8859-15" || value === "latin9") return "iso-8859-15";
  if (value === "gb2312" || value === "gbk") return "gbk";
  if (value === "big5") return "big5";
  if (value === "euc-jp") return "euc-jp";
  if (value === "shift_jis" || value === "shift-jis") return "shift_jis";
  if (value === "iso-2022-jp") return "iso-2022-jp";
  if (value === "koi8-r") return "koi8-r";
  return value;
}

function decodeQuotedPrintable(input: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < input.length) {
    const byte = input[i];
    if (byte === 0x3D) {
      if (i + 1 < input.length && input[i + 1] === 0x0A) { i += 2; continue; }
      if (i + 2 < input.length && input[i + 1] === 0x0D && input[i + 2] === 0x0A) { i += 3; continue; }
      if (i + 2 < input.length) {
        const hex = String.fromCharCode(input[i + 1], input[i + 2]);
        const val = parseInt(hex, 16);
        if (!isNaN(val)) { result.push(val); i += 3; continue; }
      }
      result.push(byte); i++;
    } else {
      result.push(byte); i++;
    }
  }
  return new Uint8Array(result);
}

function decodeBase64Bytes(input: Uint8Array): Uint8Array {
  const str = new TextDecoder("ascii").decode(input).replace(/[\r\n\s]/g, "");
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return input; }
}

function decodeMimePart(rawBytes: Uint8Array, encoding: string, charset?: string | null): string {
  const enc = (encoding || "7BIT").toUpperCase();
  let decoded: Uint8Array;
  switch (enc) {
    case "QUOTED-PRINTABLE": decoded = decodeQuotedPrintable(rawBytes); break;
    case "BASE64": decoded = decodeBase64Bytes(rawBytes); break;
    default: decoded = rawBytes;
  }
  const cs = normalizeCharset(charset);
  try { return new TextDecoder(cs).decode(decoded); }
  catch { return new TextDecoder("utf-8", { fatal: false }).decode(decoded); }
}

/* ══════════════════════════════════════════════════════════════
   SHA-256 hash (Web Crypto API)
   ══════════════════════════════════════════════════════════════ */

async function sha256hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ══════════════════════════════════════════════════════════════
   RFC 3501 §6.4.5 — BODYSTRUCTURE navigation
   ══════════════════════════════════════════════════════════════ */

type MimeLeafPart = {
  section: string;
  type: string;
  subtype: string;
  encoding: string;
  charset: string;
  contentId: string;
  dispositionType: string;
  filename: string;
  size: number;
  isInlineBody: boolean;
  isInlineImage: boolean;
  isAttachment: boolean;
};

function getPartParameter(params: Record<string, string> | undefined, key: string): string {
  if (!params) return "";
  const found = Object.entries(params).find(([k]) => k.toLowerCase() === key.toLowerCase());
  return found?.[1] || "";
}

/**
 * RFC 2231 — Decode extended parameter values.
 * Format: charset'language'encoded_value (percent-encoded)
 */
function decodeRfc2231(value: string): string {
  if (!value) return value;
  // Check if it's RFC 2231 format: charset'language'value
  const match = value.match(/^([^']*)'([^']*)'(.*)$/);
  if (match) {
    const charset = match[1] || "utf-8";
    const encoded = match[3];
    try {
      // Percent-decode
      const decoded = encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return new TextDecoder(normalizeCharset(charset)).decode(bytes);
    } catch {
      return encoded;
    }
  }
  return value;
}

function getPartFilename(part: any): string {
  // Check RFC 2231 extended params first (filename*)
  const extFilename = getPartParameter(part?.dispositionParameters, "filename*") ||
                      getPartParameter(part?.parameters, "name*");
  if (extFilename) return decodeRfc2231(extFilename);

  return (
    getPartParameter(part?.dispositionParameters, "filename") ||
    getPartParameter(part?.parameters, "name") ||
    ""
  );
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").slice(0, 180) || "attachment.bin";
}

function sanitizeMessageId(mid: string): string {
  // Only strip angle brackets — preserve @ and other RFC 5322 valid chars for deduplication
  return mid.replace(/[<>]/g, "").trim().slice(0, 250) || "unknown";
}

function collectMimeLeafParts(part: any, path: string = ""): MimeLeafPart[] {
  if (!part) return [];
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

  const isTextBody = type === "text" && (subtype === "plain" || subtype === "html") &&
    dispositionType !== "attachment" && !filename;

  const isInlineImage = type === "image" && !!contentId && dispositionType !== "attachment";

  return [{
    section, type, subtype, encoding, charset, contentId, dispositionType,
    filename: filename || (isTextBody ? "" : `${type}_${subtype}.${subtype}`),
    size: part.size || 0,
    isInlineBody: isTextBody, isInlineImage,
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

/* ══════════════════════════════════════════════════════════════
   RFC 2047 — Encoded-Word decoder
   ══════════════════════════════════════════════════════════════ */

function decodeRfc2047(input: string): string {
  if (!input) return input;
  const joined = input.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const cs = normalizeCharset(charset);
      if (encoding.toUpperCase() === "B") {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        try { return new TextDecoder(cs).decode(bytes); }
        catch { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
      }
      const decoded = text.replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      try { return new TextDecoder(cs).decode(bytes); }
      catch { return decoded; }
    } catch { return text; }
  });
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

function envelopeAddrName(addr: any): string {
  if (!addr) return "";
  return decodeRfc2047(addr.name || "") || envelopeAddr(addr);
}

function envelopeAddrList(addrs: any[]): string {
  if (!addrs || !Array.isArray(addrs)) return "";
  return addrs.map(a => envelopeAddr(a)).filter(Boolean).join(", ");
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function extractLiteralBytesFromResponse(lines: any[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  let literalStarted = false;
  for (const line of lines) {
    if (line instanceof Uint8Array) { literalStarted = true; chunks.push(line); continue; }
    if (typeof line !== "string") continue;
    if (/\{\d+\}\s*$/.test(line)) { literalStarted = true; continue; }
    if (!literalStarted) continue;
    if (/^\* \d+ FETCH/.test(line)) continue;
    if (line.trim() === ")" || /^\S+ OK/.test(line)) continue;
    chunks.push(encoder.encode(line + "\r\n"));
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
      if (match) { currentKey = match[1]; currentValue = match[2]; }
      else { currentKey = ""; currentValue = ""; }
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
   Threading — compute thread_id from References/In-Reply-To
   ══════════════════════════════════════════════════════════════ */

function computeThreadId(messageId: string, inReplyTo: string | null, references: string | null): string {
  // The thread root is the first Message-ID in the References header (RFC 5322 §3.6.4)
  if (references) {
    const refs = references.match(/[^\s<>]+@[^\s<>]+/g);
    if (refs && refs.length > 0) return refs[0];
  }
  // Fallback: use In-Reply-To as thread root
  if (inReplyTo) return inReplyTo.replace(/[<>]/g, "");
  // No threading info: this message is its own thread root
  return messageId;
}

/* ══════════════════════════════════════════════════════════════
   RFC 2046 — Multipart MIME parser for RFC822.TEXT fallback
   ══════════════════════════════════════════════════════════════ */

type FallbackResult = {
  text: string;
  html: string;
  inlineImages: Array<{ cid: string; contentType: string; data: Uint8Array }>;
};

function parseMultipartFallback(rawBytes: Uint8Array, rawText: string): FallbackResult {
  let text = "";
  let html = "";
  const inlineImages: FallbackResult["inlineImages"] = [];
  const boundaryMatch = rawText.match(/boundary="?([^\s";\r\n]+)"?/i);
  if (!boundaryMatch) return { text: "", html: "", inlineImages: [] };

  const boundary = boundaryMatch[1];
  const delimiter = "--" + boundary;
  const sections = rawText.split(delimiter);

  for (const section of sections) {
    if (!section || section.startsWith("--") || section.trim().length < 10) continue;
    const headerEnd = section.indexOf("\r\n\r\n");
    const headerEndAlt = section.indexOf("\n\n");
    const splitPos = headerEnd >= 0 ? headerEnd : headerEndAlt;
    if (splitPos < 0) continue;

    const headerPart = section.slice(0, splitPos);
    const bodyStart = headerEnd >= 0 ? splitPos + 4 : splitPos + 2;
    const bodyPart = section.slice(bodyStart);

    const ctMatch = headerPart.match(/content-type:\s*([^;\r\n]+)/i);
    const encMatch = headerPart.match(/content-transfer-encoding:\s*(\S+)/i);
    const charsetMatch = headerPart.match(/charset="?([^"\s;]+)"?/i);
    const cidMatch = headerPart.match(/content-id:\s*<?([^>\s\r\n]+)>?/i);

    const contentType = (ctMatch?.[1] || "").trim().toLowerCase();
    const encoding = (encMatch?.[1] || "7bit").trim();
    const charset = charsetMatch?.[1] || "utf-8";
    const cid = cidMatch?.[1] || "";

    if (contentType.startsWith("multipart/")) {
      const nestedBoundaryMatch = headerPart.match(/boundary="?([^\s";\r\n]+)"?/i);
      if (nestedBoundaryMatch) {
        const nestedBytes = new TextEncoder().encode(bodyPart);
        const nested = parseMultipartFallback(nestedBytes, bodyPart);
        if (nested.text && !text) text = nested.text;
        if (nested.html && !html) html = nested.html;
        inlineImages.push(...nested.inlineImages);
      }
      continue;
    }

    if (contentType === "text/plain" && !text) {
      text = decodeMimePart(new TextEncoder().encode(bodyPart), encoding, charset);
    } else if (contentType === "text/html" && !html) {
      html = decodeMimePart(new TextEncoder().encode(bodyPart), encoding, charset);
    } else if (contentType.startsWith("image/") && cid) {
      // Inline image found via Content-ID in fallback parser
      try {
        const imgBytes = new TextEncoder().encode(bodyPart);
        const decoded = encoding.toUpperCase() === "BASE64"
          ? decodeBase64Bytes(imgBytes)
          : imgBytes;
        inlineImages.push({ cid, contentType, data: decoded });
      } catch { /* skip broken inline images */ }
    }
  }
  return { text, html, inlineImages };
}

/* ══════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════ */
const BATCH_SIZE = 1;
const UID_SEARCH_INITIAL_WINDOW = 250;
const UID_SEARCH_MAX_EXPANSIONS = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_RAW_BYTES = 15 * 1024 * 1024; // 15MB max raw email to store
const MAX_RAW_FETCH_BYTES = 2 * 1024 * 1024; // 2MB — skip BODY.PEEK[] for larger messages to stay within CPU limit
const INLINE_DATA_URI_THRESHOLD = 100 * 1024; // 100KB — below this, use data URI

type NextUidBatch = {
  uids: number[];
  remaining: number;
  hasMore: boolean;
};

function parseESearchMinCount(lines: any[]): { nextUid: number | null; count: number | null } {
  for (const line of lines) {
    if (typeof line !== "string" || !line.includes("ESEARCH")) continue;
    const minMatch = line.match(/\bMIN\s+(\d+)\b/i);
    const countMatch = line.match(/\bCOUNT\s+(\d+)\b/i);
    return {
      nextUid: minMatch ? Number(minMatch[1]) : null,
      count: countMatch ? Number(countMatch[1]) : null,
    };
  }
  return { nextUid: null, count: null };
}

function parseUidSearchResponse(lines: any[], minUid: number): number[] {
  for (const line of lines) {
    if (typeof line !== "string" || !line.startsWith("* SEARCH")) continue;
    const payload = line.slice("* SEARCH".length).trim();
    if (!payload) return [];
    return payload
      .split(/\s+/)
      .map((token) => Number(token))
      .filter((uid) => Number.isFinite(uid) && uid >= minUid);
  }
  return [];
}

function parseFirstUidSearchResponse(lines: any[], minUid: number): number | null {
  for (const line of lines) {
    if (typeof line !== "string" || !line.startsWith("* SEARCH")) continue;
    const matches = line.match(/\d+/g);
    if (!matches) return null;
    for (const match of matches) {
      const uid = Number(match);
      if (Number.isFinite(uid) && uid >= minUid) return uid;
    }
  }
  return null;
}

async function getNextUidBatch(client: any, lastUid: number): Promise<NextUidBatch> {
  const minUid = Math.max(1, lastUid + 1);

  try {
    const esearchResponse = await (client as any).executeCommand(`UID SEARCH RETURN (MIN COUNT) UID ${minUid}:*`);
    const { nextUid, count } = parseESearchMinCount(esearchResponse);

    if (count === 0) {
      return { uids: [], remaining: 0, hasMore: false };
    }

    if (nextUid && nextUid >= minUid) {
      return {
        uids: [nextUid],
        remaining: Math.max(0, (count ?? 1) - 1),
        hasMore: (count ?? 0) > 1,
      };
    }
  } catch (esearchErr: any) {
    console.warn(`[check-inbox] ESEARCH MIN fallback: ${esearchErr.message}`);
  }

  let windowSize = UID_SEARCH_INITIAL_WINDOW;
  for (let attempt = 1; attempt <= UID_SEARCH_MAX_EXPANSIONS; attempt++) {
    const maxUid = minUid + windowSize - 1;
    try {
      const searchResponse = await (client as any).executeCommand(`UID SEARCH UID ${minUid}:${maxUid}`);
      const uids = parseUidSearchResponse(searchResponse, minUid).sort((a, b) => a - b);
      if (uids.length > 0) {
        return {
          uids: uids.slice(0, BATCH_SIZE),
          remaining: Math.max(0, uids.length - BATCH_SIZE),
          hasMore: true,
        };
      }
    } catch (searchErr: any) {
      console.warn(`[check-inbox] UID SEARCH ${minUid}:${maxUid} failed: ${searchErr.message}`);
    }
    windowSize *= 2;
  }

  try {
    const fallbackResponse = await (client as any).executeCommand(`UID SEARCH UID ${minUid}:*`);
    const nextUid = parseFirstUidSearchResponse(fallbackResponse, minUid);
    if (nextUid) {
      return { uids: [nextUid], remaining: 1, hasMore: true };
    }
  } catch (fallbackErr: any) {
    console.error("[check-inbox] UID SEARCH fallback error:", fallbackErr.message);
  }

  return { uids: [], remaining: 0, hasMore: false };
}

/* ══════════════════════════════════════════════════════════════
   Main handler
   ══════════════════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Support server-side worker: if called with service role + x-sync-user-id header,
    // use service role client directly and trust the user_id from the header.
    const syncUserId = req.headers.get("x-sync-user-id");
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}` && syncUserId;

    let supabase: any;
    let supabaseAdmin: any;
    let userId: string;

    if (isServiceRoleCall) {
      // Worker mode: service role for everything
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      supabase = supabaseAdmin;
      userId = syncUserId;
      console.log(`[check-inbox] Worker mode for user ${userId}`);
    } else {
      // Normal user mode
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) throw new Error("Unauthorized");
      userId = claimsData.claims.sub as string;
    }

    const imapHost = Deno.env.get("IMAP_HOST") || "";
    const imapUser = Deno.env.get("IMAP_USER") || "";
    const imapPassword = Deno.env.get("IMAP_PASSWORD") || "";
    if (!imapHost || !imapUser || !imapPassword) throw new Error("IMAP credentials not configured");

    const { data: syncState } = await supabase
      .from("email_sync_state").select("last_uid, stored_uidvalidity").eq("user_id", userId).maybeSingle();
    let lastUid = syncState?.last_uid || 0;
    const storedUidvalidity = syncState?.stored_uidvalidity || null;

    if (!syncState) {
      await supabase.from("email_sync_state").upsert({
        user_id: userId, last_uid: 0, imap_host: imapHost, imap_user: imapUser,
      }, { onConflict: "user_id" });
    }

    // Connect with retry (max 2 attempts for TLS/timeout)
    let client: ImapClient;
    const imapConfig = {
      host: imapHost, port: 993, username: imapUser, password: imapPassword,
      secure: true, connectionTimeout: 15000,
      tlsOptions: { caCerts: getCaCertsForHost(imapHost) },
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        client = new ImapClient(imapConfig);
        await client.connect();
        await client.authenticate();
        console.log(`[check-inbox] Authenticated OK (attempt ${attempt})`);
        break;
      } catch (connErr: any) {
        if (attempt === 2) throw new Error(`IMAP connection failed after 2 attempts: ${connErr.message}`);
        console.warn(`[check-inbox] Connection attempt ${attempt} failed: ${connErr.message}, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const inbox = await client.selectMailbox("INBOX");
    const uidvalidity = (inbox as any).uidValidity || null;
    console.log(`[check-inbox] INBOX: ${inbox.exists} msgs, UIDVALIDITY: ${uidvalidity}`);

    // UIDVALIDITY change detection (RFC 3501 §2.3.1.1)
    // If UIDVALIDITY changed, all cached UIDs are invalid — must resync from scratch
    if (storedUidvalidity && uidvalidity && storedUidvalidity !== uidvalidity) {
      console.warn(`[check-inbox] UIDVALIDITY changed: ${storedUidvalidity} → ${uidvalidity}. Resetting sync.`);
      lastUid = 0;
      await supabase.from("email_sync_state")
        .update({ last_uid: 0, stored_uidvalidity: uidvalidity })
        .eq("user_id", userId);
    } else if (uidvalidity && storedUidvalidity !== uidvalidity) {
      // First time seeing UIDVALIDITY — store it
      await supabase.from("email_sync_state")
        .update({ stored_uidvalidity: uidvalidity })
        .eq("user_id", userId);
    }

    // UID SEARCH
    let uids: number[] = [];
    let remainingCount = 0;
    let hasMore = false;
    try {
      const nextBatch = await getNextUidBatch(client, lastUid);
      uids = nextBatch.uids;
      remainingCount = nextBatch.remaining;
      hasMore = nextBatch.hasMore;
    } catch (searchErr: any) {
      console.error("[check-inbox] UID lookup error:", searchErr.message);
    }

    if (uids.length > 0) {
      console.log(`[check-inbox] Selected UID ${uids[0]} for this run (${remainingCount} remaining)`);
    } else {
      console.log("[check-inbox] No new UIDs");
    }
    const toFetch = uids;

    const messages: any[] = [];
    let maxUid = lastUid;

    if (toFetch.length > 0) {
      for (const uid of toFetch) {
        console.log(`[check-inbox] Processing UID ${uid}`);

        // ─── Pre-check: skip if imap_uid already exists in DB (fast-forward) ───
        const { data: existingByUid } = await supabase
          .from("channel_messages")
          .select("id")
          .eq("imap_uid", uid)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingByUid) {
          console.log(`[check-inbox] UID ${uid}: already in DB (fast-forward skip)`);
          maxUid = uid;
          await supabase.from("email_sync_state")
            .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
            .eq("user_id", userId);
          continue;
        }

        // Per-message warnings — reset for each message to prevent leaking
        const parseWarnings: string[] = [];

        try {
          /* ─── Phase 1: Check size, then conditionally fetch raw ─── */
          let rawBytes: Uint8Array = new Uint8Array(0);
          let rawHash = "";
          let rawStoragePath = "";
          let imapFlags = "";
          let internalDate: string | null = null;
          let rfc822Size = 0;

          try {
            // Step 1a: Lightweight metadata fetch (no body download)
            const metaCmd = `UID FETCH ${uid} (FLAGS INTERNALDATE RFC822.SIZE)`;
            const metaResponse = await (client as any).executeCommand(metaCmd);
            for (const line of metaResponse) {
              if (typeof line !== "string") continue;
              const flagsMatch = line.match(/FLAGS\s*\(([^)]*)\)/i);
              if (flagsMatch) imapFlags = flagsMatch[1].trim();
              const idateMatch = line.match(/INTERNALDATE\s*"([^"]+)"/i);
              if (idateMatch) {
                try {
                  const parsed = new Date(idateMatch[1]);
                  if (!isNaN(parsed.getTime())) internalDate = parsed.toISOString();
                } catch { /* ignore */ }
              }
              const sizeMatch = line.match(/RFC822\.SIZE\s+(\d+)/i);
              if (sizeMatch) rfc822Size = parseInt(sizeMatch[1], 10);
            }

            console.log(`[check-inbox] UID ${uid}: RFC822.SIZE=${rfc822Size}`);

            // Step 1b: Only fetch full raw if message is small enough for CPU budget
            if (rfc822Size > 0 && rfc822Size <= MAX_RAW_FETCH_BYTES) {
              const rawCmd = `UID FETCH ${uid} (BODY.PEEK[])`;
              const rawResponse = await (client as any).executeCommand(rawCmd);
              rawBytes = extractLiteralBytesFromResponse(rawResponse);
              if (!rfc822Size) rfc822Size = rawBytes.length;

              if (rawBytes.length > 0) {
                rawHash = await sha256hex(rawBytes);

                // Check for duplicate by hash
                const { data: existing } = await supabase
                  .from("channel_messages")
                  .select("id")
                  .eq("raw_sha256", rawHash)
                  .eq("user_id", userId)
                  .maybeSingle();

                if (existing) {
                  console.log(`[check-inbox] UID ${uid}: duplicate by SHA-256, skipping`);
                  maxUid = uid;
                  await supabase.from("email_sync_state")
                    .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
                    .eq("user_id", userId);
                  continue;
                }

                // Store raw to Storage
                rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
                const { error: rawUpErr } = await supabaseAdmin.storage
                  .from("import-files")
                  .upload(rawStoragePath, rawBytes, {
                    contentType: "message/rfc822",
                    upsert: true,
                  });
                if (rawUpErr) {
                  parseWarnings.push(`raw upload failed: ${rawUpErr.message}`);
                  rawStoragePath = "";
                }
              }
            } else if (rfc822Size > MAX_RAW_FETCH_BYTES) {
              parseWarnings.push(`raw too large (${rfc822Size}B > ${MAX_RAW_FETCH_BYTES}B), skipping raw fetch to stay within CPU limits`);
              console.log(`[check-inbox] UID ${uid}: skipping raw fetch (${rfc822Size}B too large for CPU budget)`);

              // Dedup by Message-ID instead (will be checked after envelope fetch below)
            } else {
              // rfc822Size unknown (0) — try fetching but with a safety timeout approach
              try {
                const rawCmd = `UID FETCH ${uid} (BODY.PEEK[])`;
                const rawResponse = await (client as any).executeCommand(rawCmd);
                rawBytes = extractLiteralBytesFromResponse(rawResponse);
                rfc822Size = rawBytes.length;

                if (rawBytes.length > MAX_RAW_FETCH_BYTES) {
                  // Too large — discard to save CPU
                  parseWarnings.push(`raw fetched but too large (${rawBytes.length}B), discarding`);
                  rawBytes = new Uint8Array(0);
                } else if (rawBytes.length > 0) {
                  rawHash = await sha256hex(rawBytes);
                  const { data: existing } = await supabase
                    .from("channel_messages").select("id")
                    .eq("raw_sha256", rawHash).eq("user_id", userId).maybeSingle();
                  if (existing) {
                    console.log(`[check-inbox] UID ${uid}: duplicate by SHA-256, skipping`);
                    maxUid = uid;
                    await supabase.from("email_sync_state")
                      .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
                      .eq("user_id", userId);
                    continue;
                  }
                  rawStoragePath = `raw-emails/${userId}/${uid}.eml`;
                  const { error: rawUpErr } = await supabaseAdmin.storage
                    .from("import-files")
                    .upload(rawStoragePath, rawBytes, { contentType: "message/rfc822", upsert: true });
                  if (rawUpErr) { parseWarnings.push(`raw upload failed: ${rawUpErr.message}`); rawStoragePath = ""; }
                }
              } catch (rawErr: any) {
                parseWarnings.push(`raw fetch failed: ${rawErr.message}`);
              }
            }
          } catch (rawErr: any) {
            parseWarnings.push(`metadata fetch failed: ${rawErr.message}`);
            console.warn(`[check-inbox] UID ${uid}: metadata fetch error:`, rawErr.message);
          }

          const isOversized = rfc822Size > MAX_RAW_FETCH_BYTES;

          /* ─── Phase 2: ENVELOPE + BODYSTRUCTURE ─── */
          let fromAddr = "";
          let toAddr = "";
          let ccAddresses = "";
          let bccAddresses = "";
          let senderName = "";
          let subject = "(nessun oggetto)";
          let messageId = `uid_${uid}_${Date.now()}`;
          let date = "";
          let inReplyTo: string | null = null;
          let referencesHeader: string | null = null;
          let bodyStructure: any = null;

          try {
            const envFetch = await client.fetch(String(uid), {
              byUid: true,
              uid: true,
              envelope: true,
              bodyStructure: !isOversized,
            } as any);

            const env = envFetch?.[0]?.envelope;
            bodyStructure = !isOversized ? (envFetch?.[0]?.bodyStructure || null) : null;
            if (env) {
              fromAddr = envelopeAddr(env.from?.[0]);
              toAddr = envelopeAddrList(env.to);
              ccAddresses = envelopeAddrList(env.cc);
              bccAddresses = envelopeAddrList(env.bcc);
              senderName = envelopeAddrName(env.from?.[0]) || fromAddr;
              subject = decodeRfc2047(env.subject || "") || "(nessun oggetto)";
              messageId = env.messageId ? sanitizeMessageId(env.messageId) : messageId;
              date = env.date || "";
              inReplyTo = env.inReplyTo || null;
            }
          } catch (envErr: any) {
            parseWarnings.push(`envelope error: ${envErr.message}`);
            console.warn(`[check-inbox] Envelope error UID ${uid}:`, envErr.message);
          }

          /* ─── Phase 2b: Fallback to raw headers ─── */
          if (!fromAddr || fromAddr === "@" || fromAddr === "sconosciuto@unknown") {
            try {
              const hdrCmd = `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)])`;
              const hdrResponse = await (client as any).executeCommand(hdrCmd);
              const rawHeaders = extractLiteralTextFromResponse(hdrResponse);
              if (rawHeaders) {
                const parsed = parseRawHeaders(rawHeaders);
                const rawFrom = parseEmailFromHeader(parsed["from"] || "");
                if (rawFrom && rawFrom !== "@") fromAddr = rawFrom;
                if (!toAddr || toAddr === "@") toAddr = parseEmailFromHeader(parsed["to"] || "");
                if (subject === "(nessun oggetto)" && parsed["subject"]) subject = decodeRfc2047(parsed["subject"]);
                if (!date && parsed["date"]) date = parsed["date"];
                if (messageId.startsWith("uid_") && parsed["message-id"]) messageId = sanitizeMessageId(parsed["message-id"]);
                if (!inReplyTo && parsed["in-reply-to"]) inReplyTo = parsed["in-reply-to"].replace(/[<>]/g, "");
                if (!referencesHeader && parsed["references"]) referencesHeader = parsed["references"];
                const rawFromFull = parsed["from"] || "";
                const nameMatch = rawFromFull.match(/^"?([^"<]+)"?\s*</);
                if (nameMatch) senderName = nameMatch[1].trim();
                else senderName = fromAddr;
              }
            } catch (hdrErr: any) {
              parseWarnings.push(`header fallback error: ${hdrErr.message}`);
            }
          }

          // Message-ID dedup for large messages (where we skipped raw hash dedup)
          if (!rawHash && messageId && !messageId.startsWith("uid_")) {
            const { data: existingByMid } = await supabase
              .from("channel_messages")
              .select("id")
              .eq("message_id_external", messageId)
              .eq("user_id", userId)
              .maybeSingle();
            if (existingByMid) {
              console.log(`[check-inbox] UID ${uid}: duplicate by Message-ID, skipping`);
              maxUid = uid;
              await supabase.from("email_sync_state")
                .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
                .eq("user_id", userId);
              continue;
            }
          }

          if (!fromAddr || fromAddr === "@") fromAddr = "sconosciuto@unknown";

          /* ─── Phase 3: Parse body and attachments ─── */
          let bodyText = "";
          let bodyHtml = "";
          const attachmentRecords: any[] = [];

          let parts: MimeLeafPart[] = [];
          if (!isOversized && bodyStructure) {
            try {
              parts = collectMimeLeafParts(bodyStructure);
              console.log(`[check-inbox] UID ${uid}: ${parts.length} MIME parts`);
            } catch (bsErr: any) {
              parseWarnings.push(`BODYSTRUCTURE parse failed: ${bsErr.message}`);
            }
          }

          if (parts.length === 0 && !isOversized) {
            try {
              // First, get the Content-Type header to find boundary (not included in BODY[TEXT])
              let mainBoundary = "";
              try {
                const ctHdrCmd = `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (CONTENT-TYPE)])`;
                const ctHdrResp = await (client as any).executeCommand(ctHdrCmd);
                const ctHdrText = extractLiteralTextFromResponse(ctHdrResp);
                const bndMatch = ctHdrText?.match(/boundary="?([^\s";\r\n]+)"?/i);
                if (bndMatch) mainBoundary = bndMatch[1];
              } catch { /* ignore */ }

              const rfc822Cmd = `UID FETCH ${uid} (BODY.PEEK[TEXT])`;
              const rfc822Response = await (client as any).executeCommand(rfc822Cmd);
              const textBytes = extractLiteralBytesFromResponse(rfc822Response);
              const textStr = new TextDecoder("utf-8", { fatal: false }).decode(textBytes);

              if (textStr && textStr.length > 5) {
                // Inject the boundary from header if TEXT doesn't contain it
                let parseInput = textStr;
                if (mainBoundary && !textStr.includes(`boundary`)) {
                  parseInput = `Content-Type: multipart/mixed; boundary="${mainBoundary}"\r\n\r\n` + textStr;
                }

                const parsed = parseMultipartFallback(new TextEncoder().encode(parseInput), parseInput);
                if (parsed.html) bodyHtml = parsed.html.slice(0, 100_000);
                if (parsed.text) bodyText = parsed.text.slice(0, 50_000);

                // Only use raw text as fallback if it doesn't look like raw MIME source
                if (!bodyHtml && !bodyText) {
                  const looksLikeRawMime = textStr.match(/^--[\w_=-]+\s*\r?\nContent-Type:/im) ||
                    textStr.match(/Content-Transfer-Encoding:\s*(quoted-printable|base64)/im);
                  if (looksLikeRawMime) {
                    // Try harder: split by the boundary we found in the text itself
                    const inlineBndMatch = textStr.match(/^--([\w_=+/-]+)\s*$/m);
                    if (inlineBndMatch) {
                      const retryInput = `Content-Type: multipart/mixed; boundary="${inlineBndMatch[1]}"\r\n\r\n` + textStr;
                      const retry = parseMultipartFallback(new TextEncoder().encode(retryInput), retryInput);
                      if (retry.html) bodyHtml = retry.html.slice(0, 100_000);
                      if (retry.text) bodyText = retry.text.slice(0, 50_000);
                    }
                    if (!bodyHtml && !bodyText) {
                      bodyText = "⚠️ Contenuto MIME complesso — parsing parziale non riuscito. Consultare il messaggio originale.";
                      parseWarnings.push("raw MIME detected but could not extract body parts");
                    }
                  } else {
                    bodyText = textStr.slice(0, 50_000);
                  }
                }

                // Process inline images from fallback parser
                for (const img of parsed.inlineImages) {
                  if (img.data.length <= INLINE_DATA_URI_THRESHOLD) {
                    let b64 = "";
                    const CHUNK = 8192;
                    for (let i = 0; i < img.data.length; i += CHUNK) {
                      b64 += String.fromCharCode(...img.data.subarray(i, Math.min(i + CHUNK, img.data.length)));
                    }
                    b64 = btoa(b64);
                    const dataUri = `data:${img.contentType};base64,${b64}`;
                    attachmentRecords.push({
                      cid: img.cid, publicUrl: dataUri,
                      filename: `inline_${img.cid}.${img.contentType.split("/")[1] || "bin"}`,
                      storagePath: "", contentType: img.contentType,
                      size: img.data.length, isInline: true, isDataUri: true,
                    });
                  }
                }
              }
            } catch (fallbackErr: any) {
              parseWarnings.push(`RFC822.TEXT fallback failed: ${fallbackErr.message}`);
            }
            parts = [];
          }

          if (isOversized) {
            const sizeMB = (rfc822Size / (1024 * 1024)).toFixed(1);
            console.log(`[check-inbox] UID ${uid}: oversized — metadata only (${sizeMB} MB)`);
            bodyText = `⚠️ Messaggio troppo grande per il download completo (${sizeMB} MB). Sono stati salvati solo oggetto e dati principali.`;
            bodyHtml = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-family:sans-serif"><strong>⚠️ Messaggio sovradimensionato (${sizeMB} MB)</strong><br/><p>Questo messaggio supera il limite operativo per il parsing completo.</p><p>Sono stati salvati solo: oggetto, mittente, destinatari e data.</p><p>Corpo completo e allegati non sono stati scaricati per evitare errori di elaborazione.</p></div>`;
            parseWarnings.push(`oversized message (${sizeMB}MB) — saved metadata only`);
            parts = [];
          }

          /* ─── Phase 3b: Fetch each MIME part ─── */
          for (const part of parts) {
            if (part.isInlineBody) {
              const target = part.subtype === "html" ? "html" : "text";
              if (target === "html" && bodyHtml) continue;
              if (target === "text" && bodyText) continue;

              try {
                const bodyCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const bodyResponse = await (client as any).executeCommand(bodyCmd);
                const partBytes = extractLiteralBytesFromResponse(bodyResponse);
                if (partBytes.length > 5) {
                  const decoded = decodeMimePart(partBytes, part.encoding, part.charset);
                  if (target === "html") bodyHtml = decoded.slice(0, 100_000);
                  else bodyText = decoded.slice(0, 50_000);
                }
              } catch (bodyErr: any) {
                parseWarnings.push(`body section ${part.section} error: ${bodyErr.message}`);
              }
              continue;
            }

            // Inline images (RFC 2387 + cid:)
            if (part.isInlineImage && part.contentId) {
              if (part.size > MAX_ATTACHMENT_BYTES) {
                parseWarnings.push(`inline image ${part.contentId} too large (${part.size}B)`);
                continue;
              }

              try {
                const imgCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const imgResponse = await (client as any).executeCommand(imgCmd);
                const imgRawBytes = extractLiteralBytesFromResponse(imgResponse);

                if (imgRawBytes.length > 0) {
                  const decoded: Uint8Array = decodeAttachment(imgRawBytes, part.encoding);
                  const contentType = `${part.type}/${part.subtype}`;
                  const ext = part.subtype === "jpeg" ? "jpg" : part.subtype;
                  const filename = sanitizeFilename(part.filename || `inline_${part.contentId}.${ext}`);

                  // For small images: data URI (no Storage dependency)
                  if (decoded.length <= INLINE_DATA_URI_THRESHOLD) {
                    // Safe base64 encoding without spread operator (avoids stack overflow)
                    let b64 = "";
                    const CHUNK = 8192;
                    for (let i = 0; i < decoded.length; i += CHUNK) {
                      b64 += String.fromCharCode(...decoded.subarray(i, Math.min(i + CHUNK, decoded.length)));
                    }
                    b64 = btoa(b64);
                    const dataUri = `data:${contentType};base64,${b64}`;
                    attachmentRecords.push({
                      cid: part.contentId, publicUrl: dataUri, filename,
                      storagePath: "", contentType, size: decoded.length,
                      isInline: true, isDataUri: true,
                    });
                  } else {
                    // Large images: upload to Storage
                    const storagePath = `emails/${userId}/${messageId}/${filename}`;
                    const { error: uploadErr } = await supabaseAdmin.storage
                      .from("import-files")
                      .upload(storagePath, decoded, { contentType, upsert: true });

                    if (!uploadErr) {
                      const { data: urlData } = supabaseAdmin.storage
                        .from("import-files").getPublicUrl(storagePath);
                      attachmentRecords.push({
                        cid: part.contentId, publicUrl: urlData?.publicUrl || "",
                        filename, storagePath, contentType, size: decoded.length,
                        isInline: true,
                      });
                    } else {
                      parseWarnings.push(`inline image upload failed: ${uploadErr.message}`);
                    }
                  }
                }
              } catch (imgErr: any) {
                parseWarnings.push(`inline image ${part.section} error: ${imgErr.message}`);
              }
              continue;
            }

            // Attachments
            if (part.isAttachment && part.filename) {
              if (part.size > MAX_ATTACHMENT_BYTES) {
                attachmentRecords.push({
                  filename: sanitizeFilename(part.filename), storagePath: "",
                  contentType: `${part.type}/${part.subtype}`, size: part.size,
                  isInline: false, skipped: true, contentId: part.contentId || null,
                });
                continue;
              }

              try {
                const attCmd = `UID FETCH ${uid} (BODY.PEEK[${part.section}])`;
                const attResponse = await (client as any).executeCommand(attCmd);
                const attRawBytes = extractLiteralBytesFromResponse(attResponse);

                if (attRawBytes.length > 0) {
                  const decoded: Uint8Array = decodeAttachment(attRawBytes, part.encoding);
                  const contentType = `${part.type}/${part.subtype}`;
                  const filename = sanitizeFilename(part.filename);
                  const storagePath = `emails/${userId}/${messageId}/${filename}`;

                  const { error: uploadErr } = await supabaseAdmin.storage
                    .from("import-files")
                    .upload(storagePath, decoded, { contentType, upsert: true });

                  if (!uploadErr) {
                    attachmentRecords.push({
                      filename, storagePath, contentType, size: decoded.length,
                      isInline: false, contentId: part.contentId || null,
                    });
                  } else {
                    parseWarnings.push(`attachment upload failed: ${uploadErr.message}`);
                  }
                }
              } catch (attErr: any) {
                parseWarnings.push(`attachment ${part.section} error: ${attErr.message}`);
              }
            }
          }

          /* ─── Phase 4: Replace cid: in HTML (RFC 2392) ─── */
          if (bodyHtml) {
            for (const att of attachmentRecords) {
              if (att.isInline && att.cid && att.publicUrl) {
                const escapedCid = att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Replace in src="cid:..." and url(cid:...) and url('cid:...')
                bodyHtml = bodyHtml.replace(
                  new RegExp(`cid:${escapedCid}`, 'gi'),
                  att.publicUrl
                );
              }
            }
          }

          console.log(`[check-inbox] UID ${uid}: from=${fromAddr}, text=${bodyText.length}c, html=${bodyHtml.length}c, att=${attachmentRecords.length}, raw=${rawBytes.length}B`);

          /* ─── Phase 5: Match sender ─── */
          const match = await matchSender(supabase, fromAddr);

          /* ─── Phase 6: Save message with full metadata ─── */
          let emailDate: string | null = null;
          if (date) {
            try {
              const parsed = new Date(date);
              if (!isNaN(parsed.getTime())) emailDate = parsed.toISOString();
            } catch { /* ignore */ }
          }

          const parseStatus = parseWarnings.length > 0 ? "warning" : "ok";

          const msgData = {
            user_id: userId,
            channel: "email",
            direction: "inbound",
            source_type: match.source_type,
            source_id: match.source_id,
            partner_id: match.partner_id,
            from_address: fromAddr,
            to_address: toAddr,
            cc_addresses: ccAddresses || null,
            bcc_addresses: bccAddresses || null,
            subject,
            body_text: bodyText,
            body_html: bodyHtml,
            message_id_external: messageId,
            in_reply_to: inReplyTo,
            references_header: referencesHeader || null,
            thread_id: computeThreadId(messageId, inReplyTo, referencesHeader),
            email_date: emailDate,
            raw_payload: { uid, date, sender_name: match.name || senderName },
            // New RFC-compliant fields
            raw_storage_path: rawStoragePath || null,
            raw_sha256: rawHash || null,
            raw_size_bytes: rfc822Size || null,
            imap_uid: uid,
            uidvalidity: uidvalidity,
            imap_flags: imapFlags || null,
            internal_date: internalDate || emailDate,
            parse_status: parseStatus,
            parse_warnings: parseWarnings.length > 0 ? parseWarnings : null,
          };

          const { data: savedMsg, error: saveErr } = await supabase
            .from("channel_messages")
            .upsert([msgData], { onConflict: "user_id,message_id_external" })
            .select("id")
            .single();

          if (saveErr) {
            console.error(`[check-inbox] Save error UID ${uid}:`, saveErr.message);
          } else {
            messages.push({ ...msgData, id: savedMsg.id });
            maxUid = uid;

            // Save attachments with content_id and is_inline
            if (savedMsg?.id && attachmentRecords.length > 0) {
              const attRows = attachmentRecords
                .filter(a => !a.skipped)
                .map(a => ({
                  message_id: savedMsg.id,
                  user_id: userId,
                  filename: a.filename,
                  storage_path: a.storagePath || a.publicUrl || "",
                  content_type: a.contentType,
                  size_bytes: a.size,
                  content_id: a.cid || a.contentId || null,
                  is_inline: a.isInline || false,
                }));

              if (attRows.length > 0) {
                const { error: attSaveErr } = await supabase
                  .from("email_attachments")
                  .upsert(attRows, { onConflict: "message_id,filename" });
                if (attSaveErr) {
                  console.warn(`[check-inbox] UID ${uid}: attachment DB error:`, attSaveErr.message);
                }
              }
            }

            // Checkpoint
            await supabase.from("email_sync_state")
              .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
              .eq("user_id", userId);

            // Auto-enter holding pattern: update lead_status to "contacted" if still "new"
            if (match.source_type === "imported_contact" && match.source_id) {
              await supabase.rpc("increment_contact_interaction", { p_contact_id: match.source_id });
              // Escalate from "new" to "contacted"
              await supabase.from("imported_contacts")
                .update({ lead_status: "contacted" })
                .eq("id", match.source_id)
                .eq("lead_status", "new");
            }
            if ((match.source_type === "partner" || match.source_type === "partner_contact") && match.partner_id) {
              // Read current values, then increment + escalate
              const { data: partnerData } = await supabase.from("partners")
                .select("interaction_count, lead_status")
                .eq("id", match.partner_id)
                .single();
              if (partnerData) {
                const updates: Record<string, unknown> = {
                  interaction_count: (partnerData.interaction_count || 0) + 1,
                  last_interaction_at: new Date().toISOString(),
                };
                if (partnerData.lead_status === "new") {
                  updates.lead_status = "contacted";
                }
                await supabase.from("partners")
                  .update(updates)
                  .eq("id", match.partner_id);
              }
            }
          }

          // parseWarnings is now per-message (declared inside the loop), no need to clear

        } catch (e: any) {
          console.error(`[check-inbox] Error processing UID ${uid}:`, e.message);
          if (uid > maxUid) {
            maxUid = uid;
            await supabase.from("email_sync_state")
              .update({ last_uid: uid, last_sync_at: new Date().toISOString() })
              .eq("user_id", userId);
          }
        }
      }
    }

    try { client.disconnect(); } catch (_) { /* ignore */ }

    const matched = messages.filter(m => m.source_type !== "unknown").length;

    return new Response(JSON.stringify({
      success: true,
      total: messages.length,
      matched,
      unmatched: messages.length - matched,
      last_uid: maxUid,
      remaining: remainingCount,
      has_more: hasMore,
      messages: messages.map(m => ({
        id: m.id,
        from: m.from_address,
        from_address: m.from_address,
        subject: m.subject,
        email_date: m.email_date,
        source_type: m.source_type,
        sender_name: m.raw_payload?.sender_name,
        date: m.raw_payload?.date,
        has_body: !!(m.body_text || m.body_html),
        body_text: (m.body_text || "").slice(0, 500),
        body_html: (m.body_html || "").slice(0, 8000),
        body_text_length: m.body_text?.length || 0,
        body_html_length: m.body_html?.length || 0,
        raw_size: m.raw_size_bytes || 0,
        raw_stored: !!m.raw_storage_path,
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
