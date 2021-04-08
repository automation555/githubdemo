package javacodechecker;

import java.io.Externalizable;

//EMB-ISSUE: CodeIssueNames.EXTERNALIZABLE_MUST_HAVE_NO_ARGUMENTS_CONSTRUCTOR/no-detect
public class ExternalizableMustHaveNoArgumentsConstructor3 implements Externalizable {
	private String name;
	private int age;

}