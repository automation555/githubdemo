package javacodechecker;

import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;

public class VariablesShouldNotBeSelfAssigned {

	public void setName(String name, String surName) {
		// EMB-ISSUE: CodeIssueNames.VARIABLES_SHOULD_NOT_BE_SELF_ASSIGNED
		String surName = surName;
		name = name;
	}
}