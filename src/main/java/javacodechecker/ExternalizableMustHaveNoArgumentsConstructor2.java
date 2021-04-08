package javacodechecker;

import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;

//EMB-ISSUE: CodeIssueNames.EXTERNALIZABLE_MUST_HAVE_NO_ARGUMENTS_CONSTRUCTOR/no-detect
public class ExternalizableMustHaveNoArgumentsConstructor2 implements Externalizable {
	private String name;
	private int age;

	public ExternalizableMustHaveNoArgumentsConstructor2() {

	}