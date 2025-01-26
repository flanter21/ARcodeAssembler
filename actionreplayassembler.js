function getOperand (element, length) {
	const extractAddress = /[^~x\[0][A-F0-9]+/g;
	var operand = [];

	if (element.match(extractAddress) == null) {
		operand.push('0');
	} else {
		var operand = element.match(extractAddress);
	};
	return operand[0].padStart(length, '0');
};

function chooseRegister (element, platform) {
	var register = element.slice(-1);
	if (!(register in ['1', '2'] && platform == "3ds")) {
		var register = 0;
	};
	return register;
}

function push (opcode, operand1, register, operand2, operand3, format) {
	if (format == 0) {
		opcode, operand1
	}
	instructions.push(opcode + operand1 + ' ' + operand2 + operand3);
};

function encodeARCode (code, platform) {
	var instructions = [];
	var code = code.split(';')[0]; // Ignore comments
	var elements = code.split(' ');
	const sizes = ['u32', 'u16', 'u8'];
	const operators = ['>', '<', '==', '!='];

	// Regex to remove [0x...+offset]
	const extractAddress = /[^~x\[0][A-F0-9]+/g;
	const validate = /\[0x[A-F0-9]+\+(offset|data)\]/g;

	console.log(elements);

	// Get if alternative data or offset register is being used (3DS only)
	var register = chooseRegister(elements[1], platform)

	// 0x0 - 0x2
	if (elements[0] == 'WRITE') {
		var opcode = sizes.indexOf(elements[1]);
		var operandLength = parseInt(elements[1].slice(1)) / 4;

		// Remove [0x...+offset]
		var operand1 = getOperand(elements[4], 7);
		var operand2 = getOperand(elements[2], 8);

		// Check that integer fits within selected size
		if (operand2.slice(-operandLength).padStart(8, '0') == operand2) {
			instructions.push(`${opcode}${operand1} ${operand2}`);
		} else {
			instructions.push(`Invalid code: ${code}`);
		};

	// 0x3 - 0xA, 0xDD - 0xDE
	} else if (elements[0] == 'IF') {
		var opcode = operators.indexOf(elements[3]) + 3;
		if (elements[1] == "u16") {opcode += 4;};

		// Remove [0x...+offset]
		var operand1 = getOperand(elements[elements.length-1], 7);
		var operand3 = getOperand(elements[2], 4);

		if (platform == "nds") {
			var operand2 = getOperand(elements[4], 4);
		} else if (platform == "3ds") {
			var operand2 = getOperand('0', 4);
		};
		instructions.push(`${opcode}${operand1} ${operand2}${operand3}`);

	// 0xD0, 0xD2
	} else if (elements[0] == 'END') {
		if (elements[1] == 'IF') {
			instructions.push("D0000000 00000000");
		} else if (elements[1] == 'REPEAT') {
			instructions.push("D0000000 00000001");
		} else if (elements[1] == 'ALL/NEXT') {
			instructions.push("D2000000 00000000");
		};
	
	// 0xD1
	} else if (elements[0] == 'NEXT') {
		instructions.push("D1000000 00000000");

	// 0xD2
	} else if (elements[0] == 'BREAK') {
		instructions.push("D2000000 00000001");

	// 0xC
	} else if (elements[0] == 'REPEAT') {
		if (register == 0) {
			var operand = getOperand(elements[1], 8);
		} else if (register in ['1', '2']) {
			var operand = getOperand('0', 8);
		};
		instructions.push(`C${register}000000 ${operand}`);

	// 0xD4 - 0xD5, 0xD9 - 0xDB
	} else if (elements[0].startsWith('data') ) {
		var operand = getOperand(elements[elements.length-1], 8);

		// 0xD4
		if (elements[1] == '+=') {
			var opcode = 'D4';
		} else if (elements[1] == '<-') {

			// 0xD9 - 0xDB
			if (sizes.includes(elements[2])) {
				var opcode = (0xD9 + sizes.indexOf(elements[2])).toString(16);

			// 0xD5
			} else if (!validate.test(elements[2])) {
				var opcode = 'D5';

			} else {
				instructions.push(`Invalid code: ${code}`);
			};
		} else {
			instructions.push(`Invalid code: ${code}`);
		};
		instructions.push(`${opcode}00000${register} ${operand}`);


	// 0xB, 0xD3, 0xDC
	} else if (elements[0].startsWith('offset') ) {
		var operand = getOperand(elements[2], 7);

		// 0xDC
		if (elements[1] == '+=') {
			instructions.push(`DC000000 0${operand}`);

		} else if (elements[1] == '<-') {
			// 0xB
			if (validate.test(elements[2]) ) {
				var opcode = 'B';
				instructions.push(`B${operand} 00000000`);
			
			// 0xD3
			} else {
				var opcode = 'D3';
				instructions.push(`D300000${register} 0${operand}`);
			};

		} else {
			instructions.push(`Invalid code: ${code}`);
		};

	// 0xD6 - 0xD8
	} else if (sizes.includes(elements[0])) {
		var opcode = (0xD6 + sizes.indexOf(elements[0])).toString(16).toUpperCase();
		var operand = getOperand(elements[1], 8)

		instructions.push(`${opcode}00000${register} ${operand}`);
	};
	return instructions.join('\n');
};

function getButtonsNDS (operand, instruction) {
	binary = parseInt("0x" + operand).toString(2).slice(0, 16).padStart(16, '0');
	buttons = []
	if (parseInt("0x" + instruction.slice(1)) == 0x04000130) { // is this direct addressing or indirect?
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
	} else if (parseInt("0x" + instruction.slice(1)) == 0x04000136) {
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

	const output = lines.map((line) => encodeARCode(line.trim(), platform)).join("\n", true);
	document.getElementById("output").textContent = output;
});