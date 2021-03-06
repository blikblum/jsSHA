/**
 * Return type for all the *2packed functions
 */
export interface packedValue {
  value: number[];
  binLen: number;
}

const b64Tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Convert a string to an array of big-endian words
 *
 * There is a known bug with an odd number of existing bytes and using a
 * UTF-16 encoding.  However, this function is used such that the existing
 * bytes are always a result of a previous UTF-16 str2packed call and
 * therefore there should never be an odd number of existing bytes

 * @param str String to be converted to binary representation
 * @param utfType The Unicode type, UTF8 or UTF16BE, UTF16LE, to
 *   use to encode the source string
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function str2packed(
  str: string,
  utfType: "UTF8" | "UTF16BE" | "UTF16LE",
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  let codePnt,
    codePntArr,
    byteCnt = 0,
    i,
    j,
    intOffset,
    byteOffset,
    shiftModifier,
    transposeBytes;

  existingPackedLen = existingPackedLen || 0;
  const packed = existingPacked || [0],
    existingByteLen = existingPackedLen >>> 3;

  if ("UTF8" === utfType) {
    shiftModifier = bigEndianMod === -1 ? 3 : 0;
    for (i = 0; i < str.length; i += 1) {
      codePnt = str.charCodeAt(i);
      codePntArr = [];

      if (0x80 > codePnt) {
        codePntArr.push(codePnt);
      } else if (0x800 > codePnt) {
        codePntArr.push(0xc0 | (codePnt >>> 6));
        codePntArr.push(0x80 | (codePnt & 0x3f));
      } else if (0xd800 > codePnt || 0xe000 <= codePnt) {
        codePntArr.push(0xe0 | (codePnt >>> 12), 0x80 | ((codePnt >>> 6) & 0x3f), 0x80 | (codePnt & 0x3f));
      } else {
        i += 1;
        codePnt = 0x10000 + (((codePnt & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        codePntArr.push(
          0xf0 | (codePnt >>> 18),
          0x80 | ((codePnt >>> 12) & 0x3f),
          0x80 | ((codePnt >>> 6) & 0x3f),
          0x80 | (codePnt & 0x3f)
        );
      }

      for (j = 0; j < codePntArr.length; j += 1) {
        byteOffset = byteCnt + existingByteLen;
        intOffset = byteOffset >>> 2;
        while (packed.length <= intOffset) {
          packed.push(0);
        }
        /* Known bug kicks in here */
        packed[intOffset] |= codePntArr[j] << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
        byteCnt += 1;
      }
    }
  } else {
    /* UTF16BE or UTF16LE */
    shiftModifier = bigEndianMod === -1 ? 2 : 0;
    /* Internally strings are UTF-16BE so transpose bytes under two conditions:
     * need LE and not switching endianness due to SHA-3
     * need BE and switching endianness due to SHA-3 */
    transposeBytes = ("UTF16LE" === utfType && bigEndianMod !== 1) || ("UTF16LE" !== utfType && bigEndianMod === 1);
    for (i = 0; i < str.length; i += 1) {
      codePnt = str.charCodeAt(i);
      if (transposeBytes === true) {
        j = codePnt & 0xff;
        codePnt = (j << 8) | (codePnt >>> 8);
      }

      byteOffset = byteCnt + existingByteLen;
      intOffset = byteOffset >>> 2;
      while (packed.length <= intOffset) {
        packed.push(0);
      }
      packed[intOffset] |= codePnt << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
      byteCnt += 2;
    }
  }
  return { value: packed, binLen: byteCnt * 8 + existingPackedLen };
}

/**
 * Convert a hex string to an array of big-endian words
 *
 * @param str String to be converted to binary representation
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function hex2packed(
  str: string,
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  let i, num, intOffset, byteOffset;

  if (0 !== str.length % 2) {
    throw new Error("String of HEX type must be in byte increments");
  }

  existingPackedLen = existingPackedLen || 0;
  const packed = existingPacked || [0],
    existingByteLen = existingPackedLen >>> 3,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < str.length; i += 2) {
    num = parseInt(str.substr(i, 2), 16);
    if (!isNaN(num)) {
      byteOffset = (i >>> 1) + existingByteLen;
      intOffset = byteOffset >>> 2;
      while (packed.length <= intOffset) {
        packed.push(0);
      }
      packed[intOffset] |= num << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
    } else {
      throw new Error("String of HEX type contains invalid characters");
    }
  }

  return { value: packed, binLen: str.length * 4 + existingPackedLen };
}

/**
 * Convert a string of raw bytes to an array of big-endian words
 *
 * @param str String of raw bytes to be converted to binary representation
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function bytes2packed(
  str: string,
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  let codePnt, i, intOffset, byteOffset;

  existingPackedLen = existingPackedLen || 0;
  const packed = existingPacked || [0],
    existingByteLen = existingPackedLen >>> 3,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < str.length; i += 1) {
    codePnt = str.charCodeAt(i);

    byteOffset = i + existingByteLen;
    intOffset = byteOffset >>> 2;
    if (packed.length <= intOffset) {
      packed.push(0);
    }
    packed[intOffset] |= codePnt << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
  }

  return { value: packed, binLen: str.length * 8 + existingPackedLen };
}

/**
 * Convert a base-64 string to an array of big-endian words
 *
 * @param str String to be converted to binary representation
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function b642packed(
  str: string,
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  let byteCnt = 0,
    index,
    i,
    j,
    tmpInt,
    strPart,
    intOffset,
    byteOffset;

  existingPackedLen = existingPackedLen || 0;
  const packed = existingPacked || [0],
    existingByteLen = existingPackedLen >>> 3,
    shiftModifier = bigEndianMod === -1 ? 3 : 0,
    firstEqual = str.indexOf("=");

  if (-1 === str.search(/^[a-zA-Z0-9=+/]+$/)) {
    throw new Error("Invalid character in base-64 string");
  }

  str = str.replace(/=/g, "");
  if (-1 !== firstEqual && firstEqual < str.length) {
    throw new Error("Invalid '=' found in base-64 string");
  }

  for (i = 0; i < str.length; i += 4) {
    strPart = str.substr(i, 4);
    tmpInt = 0;

    for (j = 0; j < strPart.length; j += 1) {
      index = b64Tab.indexOf(strPart.charAt(j));
      tmpInt |= index << (18 - 6 * j);
    }

    for (j = 0; j < strPart.length - 1; j += 1) {
      byteOffset = byteCnt + existingByteLen;
      intOffset = byteOffset >>> 2;
      while (packed.length <= intOffset) {
        packed.push(0);
      }
      packed[intOffset] |=
        ((tmpInt >>> (16 - j * 8)) & 0xff) << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
      byteCnt += 1;
    }
  }

  return { value: packed, binLen: byteCnt * 8 + existingPackedLen };
}

/**
 * Convert an Uint8Array to an array of big-endian words
 *
 * @param arr Uint8Array to be converted to binary
 *   representation
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function uint8array2packed(
  arr: Uint8Array,
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  let i, intOffset, byteOffset;

  existingPackedLen = existingPackedLen || 0;
  const packed = existingPacked || [0],
    existingByteLen = existingPackedLen >>> 3,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < arr.length; i += 1) {
    byteOffset = i + existingByteLen;
    intOffset = byteOffset >>> 2;
    if (packed.length <= intOffset) {
      packed.push(0);
    }
    packed[intOffset] |= arr[i] << (8 * (shiftModifier + bigEndianMod * (byteOffset % 4)));
  }

  return { value: packed, binLen: arr.length * 8 + existingPackedLen };
}

/**
 * Convert an ArrayBuffer to an array of big-endian words
 *
 * @param arr ArrayBuffer to be converted to binary
 *   representation
 * @param existingPacked A packed int array of bytes to
 *   append the results to
 * @param existingPackedLen The number of bits in the existingPacked
 *   array
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Hash list where
 *   "value" contains the output number array and "binLen" is the binary
 *   length of "value"
 */
function arraybuffer2packed(
  arr: ArrayBuffer,
  existingPacked: number[] | undefined,
  existingPackedLen: number | undefined,
  bigEndianMod: -1 | 1
): packedValue {
  return uint8array2packed(new Uint8Array(arr), existingPacked, existingPackedLen, bigEndianMod);
}

/**
 * Function that takes an input format and UTF encoding and returns the
 * appropriate function used to convert the input.
 *
 * @param format The format of the string to be converted
 * @param utfType The string encoding to use (UTF8, UTF16BE,
 *	UTF16LE)
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Function that will convert an input
 *   string to a packed int array
 */
export function getStrConverter(
  format: "HEX" | "B64" | "BYTES" | "ARRAYBUFFER" | "UINT8ARRAY" | "TEXT",
  utfType: "UTF8" | "UTF16BE" | "UTF16LE",
  bigEndianMod: -1 | 1
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
): (input: any, existingBin?: number[], existingBinLen?: number) => packedValue {
  /* Validate encoding */
  switch (utfType) {
    case "UTF8":
    /* Fallthrough */
    case "UTF16BE":
    /* Fallthrough */
    case "UTF16LE":
      /* Fallthrough */
      break;
    default:
      throw new Error("encoding must be UTF8, UTF16BE, or UTF16LE");
  }

  /* Map inputFormat to the appropriate converter */
  switch (format) {
    case "HEX":
      /**
       * @param str String of raw bytes to be converted to binary representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (str: string, existingBin?: number[], existingBinLen?: number): packedValue {
        return hex2packed(str, existingBin, existingBinLen, bigEndianMod);
      };
    case "TEXT":
      /**
       * @param str String of raw bytes to be converted to binary representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (str: string, existingBin?: number[], existingBinLen?: number): packedValue {
        return str2packed(str, utfType, existingBin, existingBinLen, bigEndianMod);
      };
    case "B64":
      /**
       * @param str String of raw bytes to be converted to binary representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (str: string, existingBin?: number[], existingBinLen?: number): packedValue {
        return b642packed(str, existingBin, existingBinLen, bigEndianMod);
      };
    case "BYTES":
      /**
       * @param str String of raw bytes to be converted to binary representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (str: string, existingBin?: number[], existingBinLen?: number): packedValue {
        return bytes2packed(str, existingBin, existingBinLen, bigEndianMod);
      };
    case "ARRAYBUFFER":
      try {
        new ArrayBuffer(0);
      } catch (ignore) {
        throw new Error("ARRAYBUFFER not supported by this environment");
      }
      /**
       * @param arr ArrayBuffer to be converted to binary
       *   representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (arr: ArrayBuffer, existingBin?: number[], existingBinLen?: number): packedValue {
        return arraybuffer2packed(arr, existingBin, existingBinLen, bigEndianMod);
      };
    case "UINT8ARRAY":
      try {
        new Uint8Array(0);
      } catch (ignore) {
        throw new Error("UINT8ARRAY not supported by this environment");
      }
      /**
       * @param arr Uint8Array to be converted to binary
       *   representation
       * @param existingBin A packed int array of bytes to
       *   append the results to
       * @param existingBinLen The number of bits in the existingBin
       *   array
       * @returns Hash list where
       *   "value" contains the output number array and "binLen" is the binary
       *   length of "value"
       */
      return function (arr: Uint8Array, existingBin?: number[], existingBinLen?: number): packedValue {
        return uint8array2packed(arr, existingBin, existingBinLen, bigEndianMod);
      };
    default:
      throw new Error("format must be HEX, TEXT, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY");
  }
}

/**
 * Convert an array of big-endian words to a hex string.
 *
 * toString() won't work here because it removes preceding zeros (e.g. 0x00000001.toString === "1" rather than
 * "00000001" and 0.toString(16) === "0" rather than "00").
 *
 * @param packed Array of integers to be converted to
 *   hexidecimal representation
 * @param outputLength Length of output in bits
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @param formatOpts Hash list
 *   containing validated output formatting options
 * @returns Hexidecimal representation of the parameter in string
 *   form
 */
export function packed2hex(
  packed: number[],
  outputLength: number,
  bigEndianMod: -1 | 1,
  formatOpts: { outputUpper: boolean; b64Pad: string }
): string {
  const hex_tab = "0123456789abcdef";
  let str = "",
    i,
    srcByte;

  const length = outputLength / 8,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < length; i += 1) {
    /* The below is more than a byte but it gets taken care of later */
    srcByte = packed[i >>> 2] >>> (8 * (shiftModifier + bigEndianMod * (i % 4)));
    str += hex_tab.charAt((srcByte >>> 4) & 0xf) + hex_tab.charAt(srcByte & 0xf);
  }

  return formatOpts["outputUpper"] ? str.toUpperCase() : str;
}

/**
 * Convert an array of big-endian words to a base-64 string
 *
 * @param packed Array of integers to be converted to
 *   base-64 representation
 * @param outputLength Length of output in bits
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @param formatOpts Hash list
 *   containing validated output formatting options
 * @returns Base-64 encoded representation of the parameter in
 *   string form
 */
export function packed2b64(
  packed: number[],
  outputLength: number,
  bigEndianMod: -1 | 1,
  formatOpts: { outputUpper: boolean; b64Pad: string }
): string {
  let str = "",
    i,
    j,
    triplet,
    int1,
    int2;

  const length = outputLength / 8,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < length; i += 3) {
    int1 = i + 1 < length ? packed[(i + 1) >>> 2] : 0;
    int2 = i + 2 < length ? packed[(i + 2) >>> 2] : 0;
    triplet =
      (((packed[i >>> 2] >>> (8 * (shiftModifier + bigEndianMod * (i % 4)))) & 0xff) << 16) |
      (((int1 >>> (8 * (shiftModifier + bigEndianMod * ((i + 1) % 4)))) & 0xff) << 8) |
      ((int2 >>> (8 * (shiftModifier + bigEndianMod * ((i + 2) % 4)))) & 0xff);
    for (j = 0; j < 4; j += 1) {
      if (i * 8 + j * 6 <= outputLength) {
        str += b64Tab.charAt((triplet >>> (6 * (3 - j))) & 0x3f);
      } else {
        str += formatOpts["b64Pad"];
      }
    }
  }
  return str;
}

/**
 * Convert an array of big-endian words to raw bytes string
 *
 * @param packed Array of integers to be converted to
 *   a raw bytes string representation
 * @param outputLength Length of output in bits
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Raw bytes representation of the parameter in string
 *   form
 */
export function packed2bytes(packed: number[], outputLength: number, bigEndianMod: -1 | 1): string {
  let str = "",
    i,
    srcByte;

  const length = outputLength / 8,
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < length; i += 1) {
    srcByte = (packed[i >>> 2] >>> (8 * (shiftModifier + bigEndianMod * (i % 4)))) & 0xff;
    str += String.fromCharCode(srcByte);
  }

  return str;
}

/**
 * Convert an array of big-endian words to an ArrayBuffer
 *
 * @param packed Array of integers to be converted to
 *   an ArrayBuffer
 * @param outputLength Length of output in bits
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Raw bytes representation of the parameter in an
 *   ArrayBuffer
 */
export function packed2arraybuffer(packed: number[], outputLength: number, bigEndianMod: -1 | 1): ArrayBuffer {
  let i;
  const length = outputLength / 8,
    retVal = new ArrayBuffer(length),
    arrView = new Uint8Array(retVal),
    shiftModifier = bigEndianMod === -1 ? 3 : 0;

  for (i = 0; i < length; i += 1) {
    arrView[i] = (packed[i >>> 2] >>> (8 * (shiftModifier + bigEndianMod * (i % 4)))) & 0xff;
  }

  return retVal;
}

/**
 * Convert an array of big-endian words to an Uint8Array
 *
 * @param packed Array of integers to be converted to
 *   an Uint8Array
 * @param outputLength Length of output in bits
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @returns Raw bytes representation of the parameter in an
 *   Uint8Array
 */
export function packed2uint8array(packed: number[], outputLength: number, bigEndianMod: -1 | 1): Uint8Array {
  let i;
  const length = outputLength / 8,
    shiftModifier = bigEndianMod === -1 ? 3 : 0,
    retVal = new Uint8Array(length);

  for (i = 0; i < length; i += 1) {
    retVal[i] = (packed[i >>> 2] >>> (8 * (shiftModifier + bigEndianMod * (i % 4)))) & 0xff;
  }

  return retVal;
}

/**
 * Function that takes an output format and associated parameters and returns a function that converts packed integers
 * to that format.
 *
 * @param format The desired output formatting (B64, HEX,
 *   BYTES, ARRAYBUFFER, or UINT8ARRAY)
 * @param outputBinLen Output length, in bits.
 * @param bigEndianMod Modifier for whether hash function is
 *   big or small endian
 * @param options Hash list of output formatting options
 * @returns Function that will convert a packed integer array to desired format.
 */
export function getOutputConverter(
  format: "HEX" | "B64" | "BYTES" | "ARRAYBUFFER" | "UINT8ARRAY",
  outputBinLen: number,
  bigEndianMod: -1 | 1,
  outputOptions: { outputUpper: boolean; b64Pad: string; shakeLen: number }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
): (binarray: number[]) => any {
  switch (format) {
    case "HEX":
      return function (binarray): string {
        return packed2hex(binarray, outputBinLen, bigEndianMod, outputOptions);
      };
    case "B64":
      return function (binarray): string {
        return packed2b64(binarray, outputBinLen, bigEndianMod, outputOptions);
      };
    case "BYTES":
      return function (binarray): string {
        return packed2bytes(binarray, outputBinLen, bigEndianMod);
      };
    case "ARRAYBUFFER":
      try {
        /* Need to test ArrayBuffer support */
        new ArrayBuffer(0);
      } catch (ignore) {
        throw new Error("ARRAYBUFFER not supported by this environment");
      }
      return function (binarray): ArrayBuffer {
        return packed2arraybuffer(binarray, outputBinLen, bigEndianMod);
      };
    case "UINT8ARRAY":
      try {
        /* Need to test Uint8Array support */
        new Uint8Array(0);
      } catch (ignore) {
        throw new Error("UINT8ARRAY not supported by this environment");
      }
      return function (binarray): Uint8Array {
        return packed2uint8array(binarray, outputBinLen, bigEndianMod);
      };
    default:
      throw new Error("format must be HEX, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY");
  }
}
