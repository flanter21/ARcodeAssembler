function formatRegister (register, instruction, platform) {
	// D3 and active register
	if (platform == "nds" || instruction.slice(0, 2) != 'D3' || instruction.slice(7) == '0') {
		return register;

	// Special case for C instructions
	} else if (instruction.slice(0, 1) == 'C') { 
		return register + "#" + (parseInt(instruction.slice(1, 2))).toString();

	// D4-DB
	} else if (instruction.slice(7) == '1' || instruction.slice(7) == '2') {
		return register + "#" + (parseInt(instruction.slice(7))).toString();

	// Throw error
	} else {
		return `Invalid instruction: ${instruction}`;
	};
};

function generateCondition (operand, instruction, platform) { // for 0x3 - 0xA
	if (platform == "3ds") {
		return `[0x0${instruction.slice(1)}+offset]`;
	} else if (platform == "nds") {
		returnvalue = ""

		if (0x7 <= parseInt(instruction.slice(0, 1)) && parseInt(instruction.slice(0, 1)) <= 0xA) {
			returnvalue += `~0x${operand.slice(0, 4)} & u16 `;
		};

		// If given address is 0000000, set address to offset
		if (parseInt(instruction.slice(1)) > 0) {
			returnvalue += `[0x0${instruction.slice(1)}]`;
		} else {
			returnvalue += `[offset]`;
		};

		// If a button combination is a condition, find it 
		if (0x4000130 <= parseInt("0x" + instruction.slice(1)) && parseInt("0x" + instruction.slice(1)) <= 0x4000136) {
			returnvalue += getButtonsNDS(operand, instruction);
		};

		return returnvalue;
	} else {
		return `Invalid instruction: ${instruction}`;
	};
};

function decodeARCode (code, platform) {
	instructions = [];

	// Strip spaces and convert to uppercase
	code = code.replace(/\s+/g, '').toUpperCase();

	if (code.length !== 16) {
		return `Invalid code length: ${code}`;
	}

	// Split the code into instruction and operand parts
	var instruction = code.slice(0, 8);
	var operand = code.slice(8);

	// Generate condition and register format for use later
	var condition = generateCondition(operand, instruction, platform);
	var register = formatRegister("data", instruction, platform);

	// Parse to determine the instruction type
	switch (instruction.slice(0, 1)) {
		// Memory writes
		case '0':
			instructions.push(`WRITE u32 0x${operand} to [0x${instruction.slice(1)}+offset]`);
			break;
		case '1':
			instructions.push(`WRITE u16 0x${operand.slice(4)} to [0x${instruction.slice(1)}+offset]`);
			break;
		case '2':
			instructions.push(`WRITE u8 0x${operand.slice(6)} to [0x${instruction.slice(1)}+offset]`);
			break;

		// Conditional (32-bit)
		case '3':
			instructions.push(`IF u32 0x${operand} > ${condition}`);
			break;
		case '4':
			instructions.push(`IF u32 0x${operand} < ${condition}`);
			break
		case '5':
			instructions.push(`IF u32 0x${operand} == ${condition}`);
			break;
		case '6':
			instructions.push(`IF u32 0x${operand} != ${condition}`);
			break;

		// Conditional (16-bit)
		case '7':
			instructions.push(`IF u16 0x${operand.slice(4)} > ${condition}`);
			break;
		case '8':
			instructions.push(`IF u16 0x${operand.slice(4)} < ${condition}`);
			break;
		case '9':
			instructions.push(`IF u16 0x${operand.slice(4)} == ${condition}`);
			break;
		case 'A':
			instructions.push(`IF u16 0x${operand.slice(4)} != ${condition}`);
			break;

		// Set offset
		case 'B':
			instructions.push(`offset <- [0x0${instruction.slice(1)}+offset]`);
			break;

		// Loops
		case 'C':
			if (platform == "nds" || instruction.slice (1, 2) == '0') {
				instructions.push(`REPEAT 0x${operand} TIMES`);
			} else if (platform == "3ds") {
				instructions.push(`REPEAT [${register}#${instruction.slice(1, 2)}] TIMES`);
			};
			break;

		case 'D':
			switch (instruction.slice(0, 2)) {
				// Terminators
				case 'D0':
					if (platform == "nds" || operand.slice(7) == '0') {
						instructions.push(`END IF`);
					} else if (operand.slice(7) == '1') {
						instructions.push(`END REPEAT`);
					} else {
						instructions.push(`Invalid instruction: ${code}`);
					};
					break;

				// Loops
				case 'D1':
					instructions.push(`NEXT REPEAT`);
					break;

				// Terminators
				case 'D2':
					if (platform == "nds" || operand.slice(7) == '0')	{
						instructions.push(`END ALL/NEXT REPEAT and RESET offset, data`);
					} else if (operand.slice(7) == '1') {
						instructions.push(`BREAK`);
					} else {
						instructions.push(`Invalid instruction: ${code}`)
					};
					break;

				// Set offset
				case 'D3':
					instructions.push(`offset <- 0x${operand}`);
					break;
				
				// Set data register
				case 'D4':
					if (platform == "nds" || instruction.slice(7) == '0') {
						instructions.push(`${register} += 0x${operand}`);
					} else if (instruction.slice(7) == '1' || instruction.slice(7) == '2') {
						instructions.push(`${register} <- data#1 + data#2 + 0x${operand}`);
					} else {
						instructions.push(`Invalid instruction: ${code}`);
					};
					break;

				// Set data register (direct, 32-bit)
				case 'D5':
					instructions.push(`${register} <- 0x${operand}`);
					break;

				// Set address (32-bit)
				case 'D6':
					instructions.push(`u32 [0x${operand}+offset] <- ${register}; offset+=4`);
					break;

				// Set address (16-bit)
				case 'D7':
					instructions.push(`u16 [0x${operand}+offset] <- ${register}; offset+=2`);
					break;
				
				// Set address (8-bit)
				case 'D8':
					instructions.push(`u8 [0x${operand}+offset] <- ${register}; offset++`);
					break;

				// Set data register (indirect, 32-bit)
				case 'D9':
					instructions.push(`${register} <- u32 [0x${operand}+offset]; offset+=4`);
					break;

				// Set data register (indirect, 16-bit)
				case 'DA':
					instructions.push(`${register} <- u16 [0x${operand}+offset]; offset+=2`);
					break;
				
				// Set data register (indirect, 8-bit)
				case 'DB':
					instructions.push(`${register} <- u8 [0x${operand}+offset]; offset++`);
					break;

				// Set offset
				case 'DC':
					instructions.push(`offset += u32 0x${operand};`);
					break;

				// Conditional (keypress)
				case 'DD':
					if (platform == "3ds") {
						buttons = getButtons3DS(operand);
						instructions.push('IF ' + buttons + ' pressed');
					} else {
						instructions.push(`Invalid instruction: ${code}`);
					};
					break;
				
				// Conditional (touchscreen)
				case 'DE':
					if (platform == "3ds" && instruction.slice(7) == '0') {
						instructions.push(`IF ${operand.slice(0,4)} >= touchpos X >= ${operand.slice(4)}`);
					} else if (platform == "3ds" && instruction.slice(7) == '1') {
						instructions.push(`IF ${operand.slice(0,4)} >= touchpos Y >= ${operand.slice(4)}`);
					} else {
						instructions.push(`Invalid instruction: ${code}`);
					};
					break;
				
				default:
					instructions.push(`Invalid instruction: ${code}`);
					break;
			};
			break;

		// Patch
		case 'E':
			instructions.push(`[${instruction.slice(1)}] <- COPY 0x${operand} bytes of ZZZZZZZZ ZZZZZZZZ`);
			//%% +1
			break;

		default:
			instructions.push((`Invalid instruction: ${code}`));
			break;
	};

	return instructions.join('\n');
};

function getButtonsNDS (operand, instruction) {
	binary = parseInt("0x" + operand).toString(2).slice(0, 16).padStart(16, '0');
	buttons = []
	if (parseInt("0x" + instruction.slice(1)) <= 0x04000134) { // is this direct addressing or indirect?
		baseaddress = 0x4000130
		buttoncodes = [ // 0x04000130
			"",
			"",
			"",
			"",
			"",
			"",
			"L",
			"R",
			"Down",
			"Up",
			"Left",
			"Right",
			"Start",
			"Select",
			"B",
			"A"
		];
	} else if (parseInt("0x" + instruction.slice(1)) >= 0x04000134) {
		baseaddress = 0x4000136
		buttoncodes = [ // 0x04000136
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"HingeClosed",
			"PenDownDSModeOnly",
			"",
			"",
			"DEBUGButton",
			"",
			"Y",
			"X"
		]
	};

	// Pop array depending on base address being written to
	
	loop = (parseInt("0x" + instruction.slice(1)) - baseaddress) * 8;
	if (loop < 0) {
		for (let i = 0; i < loop; i++) {
			buttoncodes.unshift("");
		};		
	} else {
		for (let i = 0; i < loop; i++) {
			buttoncodes.shift();
		};
	};

	// Do bitwise AND so that the button combination can be retrieved
	for (let i = 0; i < binary.length; i++) {
		if (~binary[i] & 1) {
			buttons.push(buttoncodes[i]);
		};
	};
	return "; " + buttons + " pressed";
};

// For DD type cheat
function getButtons3DS(buttons) {
	binary = parseInt("0x" + buttons).toString(2).padStart(32, '0');
	buttoncodes = [
		"CPad-Down",
		"CPad-Up",
		"CPad-Left",
		"CPad-Right",
		"CStick-Down",
		"CStick-Up",
		"CStick-Left",
		"CStick-Right",
		"",
		"",
		"",
		"Touchpad",
		"",
		"",
		"",
		"",
		"ZR",
		"ZL",
		"",
		"",
		"Y",
		"X",
		"L",
		"R",
		"Down",
		"Up",
		"Left",
		"Right",
		"Start",
		"Select",
		"B",
		"A"
	];
	buttons = [];

	// Do bitwise AND so that the button combination can be retrieved
	for (let i = 0; i < binary.length; i++) {
		if (binary[i] & 1) {
			buttons.push(buttoncodes[i]);
		};
	};

	return buttons;
};

// Event listener for decoding button
document.getElementById("decodeButton").addEventListener("click", () => {
	const input = document.getElementById("inputCodes").value;
	const lines = input.split("\n");
	platform = document.querySelector('input[name="console"]:checked').value;

	const output = lines.map((line) => decodeARCode(line.trim(), platform)).join("\n", true);
	document.getElementById("output").textContent = output;
});